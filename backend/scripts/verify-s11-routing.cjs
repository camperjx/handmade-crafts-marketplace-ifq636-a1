// Production HTTP verification against the dedicated Product test database.
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const net = require('net');
const { spawn, execFileSync } = require('child_process');
const { createHash } = require('crypto');
const { configureProductTestEnvironment } = require('../test/helpers/productFixtures');

const repo = path.resolve(__dirname, '../..');
const output = path.resolve(process.env.S11_ARTIFACT_DIR || 'artifacts/s11');
const port = Number(process.env.S11_PORT || 5002);
assert.ok(Number.isInteger(port) && port > 0 && port < 65536, 'Use a valid free test port.');
const base = 'http://127.0.0.1:' + port;
const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
const sha256 = value => createHash('sha256').update(value).digest('hex');
const report = {
  startedAt: new Date().toISOString(), sourceCommit: git('rev-parse', 'HEAD'),
  workingTree: git('status', '--short'), node: process.version, base,
  database: 'hm_s08_test', kind: 'Real production process and HTTP; no database writes', cases: [],
  serverSha256: sha256(fs.readFileSync(path.join(repo, 'backend/server.js'))),
};
fs.mkdirSync(output, { recursive: true });
const save = () => fs.writeFileSync(path.join(output, 'routing-results.json'), JSON.stringify(report, null, 2) + '\n');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let server;

async function check(name, action) {
  const row = { name, status: 'running' }; report.cases.push(row);
  try { await action(row); row.status = 'pass'; console.log('PASS ' + name); }
  catch (error) { row.status = 'fail'; throw error; }
  finally { save(); }
}
async function request(url, options = {}) {
  return fetch(base + url, { ...options, signal: AbortSignal.timeout(10000) });
}
async function stop(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  await new Promise(resolve => { child.once('exit', resolve); child.kill('SIGTERM'); });
}
async function rejectedStart(env, expectedMessage) {
  const child = spawn(process.execPath, ['backend/server.js'], { cwd: repo, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = ''; child.stderr.on('data', chunk => { stderr += chunk; }); child.stdout.resume();
  let timer;
  try {
    const code = await Promise.race([
      new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Rejected startup did not exit.')), 20000); }),
    ]);
    assert.equal(code, 1); assert.match(stderr, expectedMessage);
    assert.doesNotMatch(stderr, /mongodb(?:\+srv)?:|Unhandled|JWT_SECRET=/i);
  } finally { clearTimeout(timer); await stop(child); }
}

(async () => {
  try {
    configureProductTestEnvironment();
    const env = { ...process.env, NODE_ENV: 'production', PORT: String(port) };
    await new Promise((resolve, reject) => {
      const probe = net.createServer();
      probe.once('error', () => reject(new Error('The verification port is occupied; no existing process was stopped.')));
      probe.listen(port, () => probe.close(resolve));
    });
    server = spawn(process.execPath, ['backend/server.js'], { cwd: repo, env, stdio: ['ignore', 'pipe', 'pipe'] });
    server.stdout.resume(); server.stderr.resume();
    server.once('error', () => {});
    report.serverPid = server.pid;
    const deadline = Date.now() + 25000;
    let ready = false;
    while (Date.now() < deadline) {
      if (server.exitCode !== null) throw new Error('Production server exited before readiness.');
      try { ready = (await request('/api/health')).status === 200; } catch { /* Wait for this process. */ }
      if (ready) break; await pause(150);
    }
    assert.equal(ready, true, 'Production server did not become ready.');
    await check('Health is ready, minimal, uncached and same-origin', async row => {
      const response = await request('/api/health', { headers: { Origin: 'https://example.invalid' } });
      assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal(response.headers.get('access-control-allow-origin'), null);
      row.body = await response.json();
      assert.deepEqual(row.body, { service: 'handmade-crafts-marketplace', status: 'ready' });
    });
    const html = fs.readFileSync(path.join(repo, 'frontend/build/index.html'), 'utf8');
    const id = '0123456789abcdef01234567';
    for (const route of ['/', '/login', '/register', '/profile', '/products', '/seller/products', '/seller/products/new', '/products/' + id, '/seller/products/' + id + '/edit']) {
      await check('SPA entry ' + route, async () => {
        const response = await request(route, { headers: { Accept: 'text/html' } });
        assert.equal(response.status, 200); assert.match(response.headers.get('content-type'), /text\/html/);
        assert.equal(response.headers.get('cache-control'), 'no-store'); assert.equal(await response.text(), html);
      });
    }
    const manifest = JSON.parse(fs.readFileSync(path.join(repo, 'frontend/build/asset-manifest.json')));
    for (const asset of ['main.js', 'main.css']) {
      await check('Actual production asset ' + asset, async row => {
        row.path = manifest.files[asset]; const response = await request(row.path);
        assert.equal(response.status, 200);
        assert.match(response.headers.get('content-type'), asset.endsWith('.js') ? /javascript/ : /text\/css/);
        const received = Buffer.from(await response.arrayBuffer());
        const original = fs.readFileSync(path.join(repo, 'frontend/build', row.path));
        assert.equal(sha256(received), sha256(original)); row.sha256 = sha256(received);
      });
    }
    await check('Public Product API remains real JSON', async () => {
      const response = await request('/api/products'); assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type'), /application\/json/);
      assert.ok(Array.isArray((await response.json()).products));
    });
    for (const route of ['/api/unknown', '/api/products/unknown/nested']) {
      await check('Unknown API ' + route, async () => {
        const response = await request(route, { headers: { Accept: 'text/html' } });
        assert.equal(response.status, 404); assert.equal((await response.json()).code, 'API_NOT_FOUND');
      });
    }
    for (const route of ['/static/js/missing.js', '/static/css/missing.css', '/.env', '/backend/.env', '/server.js', '/backend/server.js', '/.git/config', '/package.json', '/unknown-page', '/products/not-an-id']) {
      await check('Resource stays unavailable ' + route, async () => {
        const response = await request(route, { headers: { Accept: 'text/html' } });
        assert.equal(response.status, 404); assert.equal((await response.json()).code, 'RESOURCE_NOT_FOUND');
      });
    }
    await check('Malformed Product API ID preserves 400 contract', async () => {
      assert.equal((await request('/api/products/not-an-id')).status, 400);
    });
    await check('HTML route does not answer an explicit JSON request', async () => {
      assert.equal((await request('/products', { headers: { Accept: 'application/json' } })).status, 404);
    });
    await check('Write to a frontend route remains 404', async () => {
      assert.equal((await request('/products', { method: 'POST' })).status, 404);
    });
    await check('Product owner route retains authentication', async () => {
      assert.equal((await request('/api/products/mine')).status, 401);
    });
    await check('Invalid port exits with a safe error', () => rejectedStart({ ...env, PORT: 'invalid' }, /Server could not start/));
    await check('Occupied port exits cleanly without stopping the running server', async () => {
      await rejectedStart(env, /Server could not listen/);
      assert.equal((await request('/api/health')).status, 200);
    });
    report.status = 'pass';
  } catch {
    report.status = 'fail'; report.error = 'Production verification failed; inspect the last recorded case and local test configuration.';
    console.error(report.error); process.exitCode = 1;
  } finally {
    await stop(server); report.serverStopped = !server || server.exitCode !== null || server.signalCode !== null;
    report.finishedAt = new Date().toISOString(); save();
    console.log('Recorded ' + report.cases.filter(row => row.status === 'pass').length + '/' + report.cases.length + ' passing production HTTP cases.');
  }
})();
