// Execute the exported collection through Newman against hm_s08_test.
// Retain assertion/status summaries, never a raw runner export containing tokens.
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const net = require('net');
const { spawn, execFileSync } = require('child_process');
const mongoose = require('mongoose');
const { configureProductTestEnvironment, connectProductTestDatabase, cleanProductFixtures } = require('../test/helpers/productFixtures');
const Product = require('../models/Product');

const repo = path.resolve(__dirname, '../..');
const output = path.resolve(process.env.S09_POSTMAN_ARTIFACT_DIR || 'artifacts/s09-postman');
const port = Number(process.env.S09_BACKEND_PORT || 5001);
const baseUrl = `http://127.0.0.1:${port}`;
const collectionPath = path.resolve(repo, process.env.PRODUCT_POSTMAN_COLLECTION || '.local/postman/products.collection.json');
const environmentPath = path.resolve(repo, process.env.PRODUCT_POSTMAN_ENVIRONMENT || '.local/postman/products.environment.json');
if (![collectionPath, environmentPath].every(file => fs.existsSync(file) && fs.statSync(file).isFile())) {
  console.error('Local Product Postman inputs are required. Configure PRODUCT_POSTMAN_COLLECTION and PRODUCT_POSTMAN_ENVIRONMENT, or provide the ignored .local/postman files.');
  process.exit(1);
}
const newman = require(process.env.S09_NEWMAN_MODULE || 'newman');
const environment = JSON.parse(fs.readFileSync(environmentPath));
environment.values.find(item => item.key === 'baseUrl').value = baseUrl;
const emails = new Set();
const report = { startedAt: new Date().toISOString(), sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(), node: process.version, runner: 'Newman', database: 'hm_s08_test', baseUrl, requests: [], assertions: [] };
fs.mkdirSync(output, { recursive: true });
let child;

(async () => {
  try {
    const uri = configureProductTestEnvironment(); await connectProductTestDatabase(uri);
    await new Promise((resolve, reject) => { const probe = net.createServer(); probe.once('error', () => reject(new Error('Test port is already in use. No existing process was stopped.'))); probe.listen(port, '127.0.0.1', () => probe.close(resolve)); });
    child = spawn(process.execPath, ['backend/server.js'], { cwd: repo, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
    const deadline = Date.now() + 20000; let ready = false;
    while (Date.now() < deadline) { try { ready = (await fetch(baseUrl + '/api/products')).status === 200; } catch { /* Wait for DB readiness. */ } if (ready) break; await new Promise(resolve => setTimeout(resolve, 100)); }
    assert.equal(ready, true, 'The dedicated backend did not become ready.');
    report.beforeCount = await Product.countDocuments({});
    const summary = await new Promise((resolve, reject) => {
      const run = newman.run({ collection: collectionPath, environment, iterationCount: 1, timeoutRequest: 15000, reporters: [], color: 'off' }, (error, result) => error ? reject(new Error('Newman could not finish the collection.')) : resolve(result));
      run.on('request', (error, args) => {
        const pathname = args.request.url.getPath();
        if (pathname === '/api/auth/register') {
          try { const email = JSON.parse(args.request.body.raw).email; if (/^s09s10-[a-f\d-]+-(seller-a|seller-b|buyer)@example\.com$/i.test(email)) emails.add(email); } catch { /* Never retain request bodies. */ }
        }
        const row = { name: args.item.name, method: args.request.method, path: pathname, status: args.response?.code || 0, transportError: Boolean(error) };
        if (pathname.startsWith('/api/products') && args.response) {
          try { const data = args.response.json(); if (data.product) row.product = data.product; if (data.products) row.productIds = data.products.map(product => product.id); if (data.code) row.code = data.code; } catch { /* A parse failure is represented by the assertion results. */ }
        }
        report.requests.push(row); console.log(`${row.status} ${row.name}`);
      });
      run.on('assertion', (error, args) => report.assertions.push({ name: args.assertion, passed: !error, skipped: Boolean(args.skipped) }));
    });
    report.stats = summary.run.stats;
    report.failures = summary.run.failures.map(failure => ({ request: failure.source?.name, assertion: failure.error?.test || failure.error?.name || 'failure' }));
    assert.equal(report.failures.length, 0, 'The Postman collection has failed assertions.');
    assert.equal(report.requests.length, 38); assert.equal(emails.size, 3, 'Expected three generated fixture identities.');
    // Public fixture IDs must not reveal the generated local password.
    const publicGuid = summary.environment.get('runId').replace(/^s09s10-/, '');
    assert.equal(summary.environment.get('testPassword').includes(publicGuid), false);
    report.independentFixturePassword = true;
    const id = summary.environment.get('productId');
    report.finalProduct = JSON.parse(JSON.stringify(await Product.findById(id).lean()));
    report.afterCount = await Product.countDocuments({});
    assert.equal(report.afterCount, report.beforeCount + 1);
    assert.equal(report.finalProduct.priceCents, 3000); assert.equal(report.finalProduct.status, 'archived');
    report.status = 'pass';
  } catch (error) {
    report.status = 'fail'; report.error = error.message === 'The Postman collection has failed assertions.' ? error.message : 'Postman verification could not complete; inspect the sanitized status/assertion records.'; process.exitCode = 1;
  } finally {
    try { report.cleanup = await cleanProductFixtures(emails); } catch { report.cleanup = 'Scoped fixture cleanup could not be confirmed.'; process.exitCode = 1; }
    if (child && child.exitCode === null) await new Promise(resolve => { child.once('exit', resolve); child.kill('SIGTERM'); });
    await mongoose.disconnect(); report.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(output, 'newman-results.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(`Newman ${report.status}: ${report.requests.length} requests, ${report.assertions.filter(row => row.passed).length} passing assertions; scoped cleanup recorded.`);
  }
})();
