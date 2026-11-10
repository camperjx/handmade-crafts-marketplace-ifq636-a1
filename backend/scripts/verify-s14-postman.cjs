const fs=require('fs');const path=require('path');const assert=require('assert/strict');const mongoose=require('mongoose');
const {configureOrderTestEnvironment,connectOrderTestDatabase,fixtureScope}=require('../test/helpers/orderFixtures');
const Order=require('../models/Order');const Product=require('../models/Product');
const {repo,sourceInfo,artifactDir,start,stop}=require('./lib/orderRuntime.cjs');
const output=artifactDir('s14-postman'),scope=fixtureScope();let server;
const report={startedAt:new Date().toISOString(),...sourceInfo(),runner:'Newman',database:'hm_s12_s14_test',requests:[],assertions:[]};
const collectionPath=path.join(repo,'docs/orders/postman/s12-s14-orders.postman_collection.json');
const environment=JSON.parse(fs.readFileSync(path.join(repo,'docs/orders/postman/s12-s14-local.postman_environment.json')));
const put=(key,value)=>{const entry=environment.values.find(row=>row.key===key);if(entry)entry.value=value;else environment.values.push({key,value,enabled:true});};
for(const [label,role] of [['sellerA','seller'],['sellerB','seller'],['buyerA','buyer'],['buyerB','buyer']]){const identity=scope.identity(label,role);put(label+'Email',identity.email);put(label+'Password',identity.password);}
put('runId',scope.prefix);
(async()=>{
 try{
  const uri=configureOrderTestEnvironment();await connectOrderTestDatabase(uri);server=await start(5006);put('baseUrl','http://127.0.0.1:5006');report.baseUrl='http://127.0.0.1:5006';
  const newman=require(process.env.NEWMAN_MODULE || 'newman');
  const summary=await new Promise((resolve,reject)=>{
   const run=newman.run({collection:collectionPath,environment,reporters:[],timeoutRequest:15000,color:'off'},(error,result)=>error?reject(new Error('The exported collection could not complete.')):resolve(result));
   run.on('request',(error,args)=>{const route=args.request.url.getPath();const row={name:args.item.name,method:args.request.method,path:route,httpStatus:args.response?.code || 0,transportError:Boolean(error)};if(route.startsWith('/api/orders')&&args.response){try{const body=args.response.json();if(body.order)row.order=body.order;if(body.code)row.code=body.code;}catch{/* Assertions capture invalid JSON. */}}report.requests.push(row);console.log(row.httpStatus+' '+row.name);});
   run.on('assertion',(error,args)=>report.assertions.push({name:args.assertion,passed:!error,skipped:Boolean(args.skipped)}));
  });
  report.stats=summary.run.stats;report.failures=summary.run.failures.map(row=>({request:row.source?.name,assertion:row.error?.test || row.error?.name || 'failure'}));
  assert.equal(report.failures.length,0);const get=key=>summary.environment.get(key);
  const success=await Order.findById(get('orderSuccessId')).lean(),rejected=await Order.findById(get('orderRejectId')).lean(),snapshot=await Order.findById(get('orderSnapshotId')).lean();
  assert.equal(success.status,'completed');assert.equal(rejected.status,'rejected');assert.equal(snapshot.totalCents,5000);assert.equal(snapshot.unitPriceCents,2500);assert.equal(snapshot.productTitle,get('snapshotTitle'));
  assert.equal((await Product.findById(get('productActiveId')).lean()).status,'archived');
  report.persistedOutcomes={completed:success.status,rejected:rejected.status,snapshotUnitPriceCents:snapshot.unitPriceCents,snapshotTotalCents:snapshot.totalCents,productStatus:'archived'};
  report.status='pass';
 }catch{report.status='fail';console.error('Postman collection verification failed; inspect sanitised request/assertion records.');process.exitCode=1;}
 finally{
  await stop(server);report.serverStopped=true;
  try{if(mongoose.connection.readyState===1)report.cleanup=await scope.cleanup();}catch{report.cleanup={status:'failed'};report.status='fail';process.exitCode=1;}
  await mongoose.disconnect();report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(output,'newman-results.json'),JSON.stringify(report,null,2)+'\n');
  console.log('Newman '+report.status+': '+report.requests.length+' requests, '+report.assertions.filter(row=>row.passed).length+' passing assertions; scoped cleanup recorded.');
 }
})();
