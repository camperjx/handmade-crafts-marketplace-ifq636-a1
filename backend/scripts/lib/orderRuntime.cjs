const fs = require('fs');
const path = require('path');
const net = require('net');
const { spawn, execFileSync } = require('child_process');
const { createHash } = require('crypto');
const { configureOrderTestEnvironment } = require('../../test/helpers/orderFixtures');
const repo = path.resolve(__dirname, '../../..');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const sha256 = value => createHash('sha256').update(value).digest('hex');
function sourceInfo() {
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
  const files = git('ls-files', '--cached', '--others', '--exclude-standard').split('\n').filter(name => /^(backend\/|frontend\/src\/|docs\/|README|frontend\/package)/.test(name));
  return { sourceCommit: git('rev-parse','HEAD'), workingTree: git('status','--short'), node: process.version,
    sourceHashes: Object.fromEntries(files.filter(file=>fs.statSync(path.join(repo,file)).isFile()).map(file=>[file,sha256(fs.readFileSync(path.join(repo,file)))])) };
}
function artifactDir(fallback) { const output=path.resolve(repo,process.env.S14_ARTIFACT_DIR || 'artifacts/'+fallback);fs.mkdirSync(output,{recursive:true});return output; }
async function stop(server) {
  if (!server || server.exitCode !== null || server.signalCode !== null) return;
  await new Promise(resolve => { const timer=setTimeout(()=>server.kill('SIGKILL'),5000); server.once('exit',()=>{clearTimeout(timer);resolve();});server.kill('SIGTERM'); });
}
async function start(port) {
  configureOrderTestEnvironment();
  await new Promise((resolve,reject)=>{const probe=net.createServer();probe.once('error',()=>reject(new Error('Test port is occupied; no existing process was stopped.')));probe.listen(port,'127.0.0.1',()=>probe.close(resolve));});
  const server=spawn(process.execPath,['backend/server.js'],{cwd:repo,env:{...process.env,NODE_ENV:'production',PORT:String(port)},stdio:['ignore','pipe','pipe']});
  server.stdout.resume();server.stderr.resume();let spawnError=false;server.once('error',()=>{spawnError=true;});
  const deadline=Date.now()+25000;
  while(Date.now()<deadline){
    if(spawnError || server.exitCode!==null)break;
    try { if((await fetch('http://127.0.0.1:'+port+'/api/health',{signal:AbortSignal.timeout(1000)})).status===200)return server; } catch { /* Wait only for this child. */ }
    await pause(150);
  }
  await stop(server);throw new Error('The isolated production server did not become ready.');
}
module.exports={repo,pause,sha256,sourceInfo,artifactDir,start,stop};
