// Real HTTP and Node-process restart verification against the dedicated test DB.
const fs = require('fs');
const path = require('path');
const net = require('net');
const assert = require('assert/strict');
const { spawn, execFileSync } = require('child_process');
const { randomUUID, randomBytes } = require('crypto');
const mongoose = require('mongoose');
const { configureProductTestEnvironment, connectProductTestDatabase, cleanProductFixtures } = require('../test/helpers/productFixtures');
const Product = require('../models/Product');

const output = path.resolve(process.env.S08_ARTIFACT_DIR || path.join(__dirname, '../../artifacts/s08'));
const report = { kind: 'Automated HTTP, real MongoDB and actual Node process restart; not a Postman GUI session', startedAt: new Date().toISOString(), cases: [], exchanges: [] };
const emails = new Set();
const prefix = 's08-runtime-' + randomUUID();
const password = randomBytes(18).toString('hex');
let child, baseUrl, port, uri;

function publicBody(value) {
  if (Array.isArray(value)) return value.map(publicBody);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => !['token','password','email','address'].includes(key)).map(([key, item])=>[key,publicBody(item)]));
  return value;
}
async function request(label, method, route, user, body) {
  const response = await fetch(baseUrl + route, {
    method, headers: { ...(body === undefined ? {} : {'Content-Type':'application/json'}), ...(user ? {Authorization:'Bearer '+user.token}: {}) },
    ...(body === undefined ? {} : {body:JSON.stringify(body)}),
  });
  const json = await response.json();
  report.exchanges.push({label,method,route,role:user?.role || 'anonymous',status:response.status,request:publicBody(body),response:publicBody(json)});
  return {status:response.status,body:json};
}
async function runCase(id, description, action) {
  await action(); report.cases.push({id,description,result:'passed'});
  console.log(id+' passed: '+description);
}
async function availablePort() {
  const server = net.createServer();
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const value=server.address().port;
  await new Promise(resolve=>server.close(resolve));
  return value;
}
async function startServer() {
  child=spawn(process.execPath,[path.join(__dirname,'../server.js')],{
    env:{...process.env,MONGO_URI:uri,PORT:String(port)},stdio:['ignore','pipe','pipe'],
  });
  const current=child;
  await new Promise((resolve,reject)=>{
    let text='';
    const timer=setTimeout(()=>reject(new Error('Server readiness timeout.')),30000);
    current.once('error',()=>{clearTimeout(timer);reject(new Error('Server process could not start.'));});
    current.once('exit',()=>{clearTimeout(timer);reject(new Error('Server exited before verification completed.'));});
    current.stdout.on('data',data=>{
      text+=data.toString();
      if(text.includes('Server running on port '+port)){clearTimeout(timer);resolve();}
    });
    current.stderr.on('data',()=>{});
  });
  return current.pid;
}
async function stopServer() {
  if(!child || child.exitCode!==null) return;
  const current=child;
  await new Promise(resolve=>{
    const timer=setTimeout(()=>current.kill('SIGKILL'),5000);
    current.once('exit',()=>{clearTimeout(timer);resolve();});current.kill('SIGTERM');
  });
  child=null;
}
async function register(label,role) {
  const email=prefix+'-'+label+'@example.com'; emails.add(email);
  const created=await request('Register '+label,'POST','/api/auth/register',null,{name:'Runtime '+label,email,password,role});
  assert.equal(created.status,201);
  return login(label,email);
}
async function login(label,email) {
  const result=await request('Login '+label,'POST','/api/auth/login',null,{email,password});
  assert.equal(result.status,200); return result.body;
}

(async()=>{
  fs.mkdirSync(output,{recursive:true});
  try {
    const repo=path.join(__dirname,'../..');
    report.source={commit:execFileSync('git',['-C',repo,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),workingTreeClean:execFileSync('git',['-C',repo,'status','--porcelain'],{encoding:'utf8'}).trim()==='',node:process.version};
  } catch { report.source={commit:null,node:process.version}; }
  uri=configureProductTestEnvironment(); await connectProductTestDatabase(uri);
  port=await availablePort(); baseUrl='http://127.0.0.1:'+port;
  report.baseUrl=baseUrl; report.database='hm_s08_test'; report.initialProcessId=await startServer();
  const seller=await register('seller','seller'),other=await register('other','seller'),buyer=await register('buyer','buyer');
  let item;
  await runCase('R01','Seller creates an active persisted Product',async()=>{
    const created=await request('Create Product','POST','/api/products',seller,{title:prefix+' mug',description:'Handmade ceramic mug',category:'Ceramics',priceCents:2500});
    assert.equal(created.status,201);item=created.body.product;assert.equal(item.sellerId,seller.id);assert.equal((await Product.findById(item.id).lean()).priceCents,2500);
  });
  await runCase('R02','Anonymous reads and Seller mine use real saved data',async()=>{
    assert.equal((await request('Public detail','GET','/api/products/'+item.id)).body.product.priceCents,2500);
    assert.ok((await request('Public catalogue','GET','/api/products')).body.products.some(row=>row.id===item.id));
    assert.ok((await request('Seller mine','GET','/api/products/mine',seller)).body.products.some(row=>row.id===item.id));
    assert.ok(!(await request('Other Seller mine','GET','/api/products/mine',other)).body.products.some(row=>row.id===item.id));
  });
  await runCase('R03','HM-15 AC4: Buyer writes receive 403 and do not mutate MongoDB',async()=>{
    const before=JSON.stringify(await Product.findById(item.id).lean()),count=await Product.countDocuments({});
    assert.equal((await request('Buyer create denied','POST','/api/products',buyer,{title:'Forbidden',description:'No write',category:'Ceramics',priceCents:1})).status,403);
    assert.equal((await request('Buyer patch denied','PATCH','/api/products/'+item.id,buyer,{priceCents:1})).status,403);
    const afterCount=await Product.countDocuments({});
    assert.equal(afterCount,count);assert.equal(JSON.stringify(await Product.findById(item.id).lean()),before);
    report.buyerWriteDatabaseUnchanged=true;
    report.buyerWriteChecks={productCountBefore:count,productCountAfter:afterCount,targetRecordUnchanged:true};
  });
  await runCase('R04','Other Seller modification receives 403 without a write',async()=>{
    const before=JSON.stringify(await Product.findById(item.id).lean());
    assert.equal((await request('Other Seller patch denied','PATCH','/api/products/'+item.id,other,{status:'archived'})).status,403);
    assert.equal(JSON.stringify(await Product.findById(item.id).lean()),before);
  });
  await runCase('R05','Whole invalid patches are rejected without partial persistence',async()=>{
    const before=JSON.stringify(await Product.findById(item.id).lean());
    assert.equal((await request('Invalid price','PATCH','/api/products/'+item.id,seller,{title:'Must not persist',priceCents:'3000'})).status,400);
    assert.equal((await request('Forged owner','PATCH','/api/products/'+item.id,seller,{title:'Must not persist',sellerId:other.id})).status,400);
    assert.equal(JSON.stringify(await Product.findById(item.id).lean()),before);
  });
  await runCase('R06','Owner saves 3000 cents and a new public read observes it',async()=>{
    assert.equal((await request('Owner update','PATCH','/api/products/'+item.id,seller,{title:prefix+' updated mug',priceCents:3000})).status,200);
    assert.equal((await request('Public updated detail','GET','/api/products/'+item.id)).body.product.priceCents,3000);
  });
  await runCase('R07','Soft archive preserves history and enforces visibility',async()=>{
    assert.equal((await request('Owner archive','PATCH','/api/products/'+item.id,seller,{status:'archived'})).status,200);
    assert.equal((await request('Archived public detail','GET','/api/products/'+item.id)).status,404);
    assert.equal((await request('Archived Buyer detail','GET','/api/products/'+item.id,buyer)).status,404);
    assert.equal((await request('Archived other detail','GET','/api/products/'+item.id,other)).status,404);
    assert.ok(!(await request('Catalogue after archive','GET','/api/products')).body.products.some(row=>row.id===item.id));
    assert.equal((await request('Archived owner detail','GET','/api/products/'+item.id,seller)).body.product.status,'archived');
    assert.equal((await Product.findById(item.id).lean()).status,'archived');
  });
  await runCase('R08','Archived records reject repeated writes and reopening',async()=>{
    assert.equal((await request('Repeated archive','PATCH','/api/products/'+item.id,seller,{status:'archived'})).status,409);
    assert.equal((await request('Archived edit','PATCH','/api/products/'+item.id,seller,{priceCents:4000})).status,409);
    assert.equal((await request('Reopen rejected','PATCH','/api/products/'+item.id,seller,{status:'active'})).status,400);
  });
  await runCase('R09','P29: a different Node process retains the saved Product after restart and login',async()=>{
    const before=JSON.stringify(await Product.findById(item.id).lean());
    await stopServer();report.restartedProcessId=await startServer();assert.notEqual(report.initialProcessId,report.restartedProcessId);
    const signedIn=await login('seller after restart',seller.email);
    const detail=await request('Owner detail after process restart','GET','/api/products/'+item.id,signedIn);
    assert.equal(detail.status,200);assert.equal(detail.body.product.priceCents,3000);assert.equal(detail.body.product.status,'archived');
    assert.equal(JSON.stringify(await Product.findById(item.id).lean()),before);report.processRestartPersisted=true;
    report.savedProduct=publicBody(detail.body.product);
  });
  report.result='passed';
})().catch(()=>{report.result='failed';report.failure='Runtime verification failed. Inspect the last recorded exchange and case; secrets are not included.';process.exitCode=1;}).finally(async()=>{
  try { await stopServer();if(mongoose.connection.readyState===1 && mongoose.connection.name==='hm_s08_test') report.cleanup=await cleanProductFixtures(emails); }
  catch { report.result='failed';report.cleanup={result:'failed'};process.exitCode=1; }
  finally {
    await mongoose.disconnect();report.completedAt=new Date().toISOString();
    fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'runtime-results.json'),JSON.stringify(report,null,2)+'\n');
    console.log('Result: '+report.result+'; '+report.cases.length+' runtime cases; process restart '+Boolean(report.processRestartPersisted)+'.');
    if(report.cleanup) console.log('Fixture cleanup: '+JSON.stringify(report.cleanup));
  }
});
