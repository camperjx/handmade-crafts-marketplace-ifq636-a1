const fs=require('fs');const path=require('path');const assert=require('assert/strict');
const {repo,sha256,sourceInfo,artifactDir,start,stop}=require('./lib/orderRuntime.cjs');
const output=artifactDir('s14-routing'),base='http://127.0.0.1:5005';let server;
const report={startedAt:new Date().toISOString(),...sourceInfo(),database:'hm_s12_s14_test',base,kind:'Real production HTTP, no database writes',cases:[]};
async function check(name,fn){const row={name,status:'running'};report.cases.push(row);await fn(row);row.status='pass';console.log('PASS '+name);}
(async()=>{
 try {
  server=await start(5005);report.serverPid=server.pid;
  const id='0123456789abcdef01234567';const html=fs.readFileSync(path.join(repo,'frontend/build/index.html'),'utf8');
  for(const route of ['/','/login','/register','/profile','/products','/seller/products','/seller/products/new','/products/'+id,'/seller/products/'+id+'/edit','/orders','/seller/orders','/orders/'+id,'/products/'+id+'/request'])await check('HTML deep link '+route,async()=>{const res=await fetch(base+route,{headers:{Accept:'text/html'}});assert.equal(res.status,200);assert.match(res.headers.get('content-type'),/text\/html/);assert.equal(await res.text(),html);});
  for(const route of ['/api/orders/mine','/api/orders/seller','/api/orders/'+id])await check('Private API '+route,async()=>{const res=await fetch(base+route);assert.equal(res.status,401);assert.equal((await res.json()).code,'UNAUTHENTICATED');});
  await check('Unknown API is JSON 404',async()=>{const res=await fetch(base+'/api/orders/unknown/nested');assert.equal(res.status,404);assert.equal((await res.json()).code,'API_NOT_FOUND');});
  for(const route of ['/.env','/backend/.env','/backend/server.js','/.git/config','/static/js/missing.js','/unknown-page','/orders/bad'])await check('Unavailable resource '+route,async()=>{const res=await fetch(base+route);assert.equal(res.status,404);assert.equal((await res.json()).code,'RESOURCE_NOT_FOUND');});
  const manifest=JSON.parse(fs.readFileSync(path.join(repo,'frontend/build/asset-manifest.json')));
  for(const file of ['main.js','main.css'])await check('Exact production asset '+file,async row=>{const route=manifest.files[file];const res=await fetch(base+route);assert.equal(res.status,200);row.sha256=sha256(Buffer.from(await res.arrayBuffer()));assert.equal(row.sha256,sha256(fs.readFileSync(path.join(repo,'frontend/build',route))));});
  await check('Minimal readiness without production CORS',async()=>{const res=await fetch(base+'/api/health',{headers:{Origin:'https://example.invalid'}});assert.equal(res.status,200);assert.equal(res.headers.get('access-control-allow-origin'),null);assert.equal(res.headers.get('cache-control'),'no-store');assert.deepEqual(await res.json(),{service:'handmade-crafts-marketplace',status:'ready'});});
  report.status='pass';
 }catch{report.status='fail';console.error('Production routing verification failed.');process.exitCode=1;}
 finally{await stop(server);report.serverStopped=true;report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(output,'routing-results.json'),JSON.stringify(report,null,2)+'\n');}
})();
