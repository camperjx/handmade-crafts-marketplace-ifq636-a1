// Real Chrome -> CRA proxy -> Express -> dedicated MongoDB verification.
// Install Playwright separately and set S09_BROWSER_MODULE. No personal browser profile or HAR is used.
const fs = require('fs');
const path = require('path');
const net = require('net');
const assert = require('assert/strict');
const { spawn, execFileSync } = require('child_process');
const { randomUUID, randomBytes } = require('crypto');
const { chromium } = require(process.env.S09_BROWSER_MODULE || 'playwright');
const mongoose = require('../../backend/node_modules/mongoose');
const { configureProductTestEnvironment, connectProductTestDatabase, cleanProductFixtures } = require('../../backend/test/helpers/productFixtures');
const Product = require('../../backend/models/Product');
const User = require('../../backend/models/User');

const repo = path.resolve(__dirname, '../..');
const output = path.resolve(process.env.S09_ARTIFACT_DIR || 'artifacts/s09-s10');
const base = process.env.S09_FRONTEND_URL || 'http://localhost:3000';
const port = Number(process.env.S09_BACKEND_PORT || 5001);
const apiBase = `http://127.0.0.1:${port}`;
const password = randomBytes(20).toString('hex');
const prefix = 'wf1-' + randomUUID();
const emails = ['seller-a', 'seller-b', 'buyer-a'].map(role => `${prefix}-${role}@example.com`);
const title = `Handwoven Basket ${prefix.slice(0, 12)}`;
const changedTitle = `${title} - revised`;
const unknownTitle = `Ceramic Bowl ${prefix.slice(0, 12)}`;
const values = { title, description: 'Handwoven cotton basket, made with care in Brisbane.', category: 'Textiles', priceCents: 2500 };
const tokenKey = 'hm.auth.token.v1';
const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
const report = {
  startedAt: new Date().toISOString(), timezone: 'Australia/Brisbane', sourceCommit: git('rev-parse', 'HEAD'),
  workingTree: git('status', '--short'), node: process.version, frontend: base, database: 'hm_s08_test',
  kind: 'Real browser/API/DB; controlled delays and injected failures are explicitly identified', cases: [], productRequests: [], pageErrors: [],
};
fs.mkdirSync(output, { recursive: true });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const sanitized = error => String(error?.message || error).replaceAll(password, '[redacted]');
const save = () => fs.writeFileSync(path.join(output, 'browser-results.json'), JSON.stringify(report, null, 2) + '\n');
let backend, browser, seller, other, buyer, anonymous, mainProduct, unknownProduct;
const screenshot = (page, name) => page.screenshot({ path: path.join(output, name + '.png'), fullPage: true });
const signedIn = page => page.evaluate(key => Boolean(sessionStorage.getItem(key)), tokenKey);
const heading = (page, name) => page.getByRole('heading', { name, exact: true }).waitFor();
const card = (page, name) => page.getByRole('article', { name, exact: true });
async function until(test, timeout = 20000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { if (await test()) return; await sleep(100); }
  throw new Error('The expected local application state was not ready.');
}
async function check(id, name, type, action) {
  const row = { id, name, type, startedAt: new Date().toISOString(), status: 'running' };
  report.cases.push(row); save();
  try { await action(row); row.status = 'pass'; console.log('PASS ' + id + ' ' + name); }
  catch (error) { row.status = 'fail'; row.error = sanitized(error); throw error; }
  finally { row.finishedAt = new Date().toISOString(); save(); }
}
async function startBackend() {
  await new Promise((resolve, reject) => {
    const probe = net.createServer(); probe.once('error', () => reject(new Error('The test backend port is already in use; no existing process was stopped.')));
    probe.listen(port, '127.0.0.1', () => probe.close(resolve));
  });
  backend = spawn(process.execPath, ['backend/server.js'], { cwd: repo, env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
  backend.stdout.on('data', () => {}); backend.stderr.on('data', () => {});
  await until(async () => { try { return (await fetch(apiBase + '/api/products')).status === 200; } catch { return false; } });
  return backend.pid;
}
async function stopBackend() {
  if (!backend || backend.exitCode !== null) return;
  const child = backend;
  await new Promise(resolve => { child.once('exit', resolve); child.kill('SIGTERM'); });
  backend = null;
}
async function call(method, url, body, page, authorization) {
  const token = page ? await page.evaluate(key => sessionStorage.getItem(key), tokenKey) : authorization;
  const response = await fetch(apiBase + url, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const data = await response.json();
  return { status: response.status, body: data };
}
async function register(page, role, email, name) {
  await page.goto(base + '/register');
  await page.getByRole('radio', { name: role === 'seller' ? 'Seller' : 'Buyer', exact: true }).check();
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.waitForURL('**/login');
}
async function login(page, email, destination) {
  if (!(await page.url()).endsWith('/login')) await page.goto(base + '/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL(base + destination);
}
async function fillProduct(page, productTitle, amount = '25.00') {
  await page.getByLabel('Title', { exact: true }).fill(productTitle);
  await page.getByLabel('Description', { exact: true }).fill(values.description);
  await page.getByLabel('Category', { exact: true }).fill(values.category);
  await page.getByLabel('Price (AUD)', { exact: true }).fill(amount);
}
const productSnapshot = async id => JSON.parse(JSON.stringify(await Product.findById(id).lean()));

(async () => {
  try {
    const uri = configureProductTestEnvironment();
    await connectProductTestDatabase(uri);
    report.backendPidBeforeRestart = await startBackend();
    browser = await chromium.launch({ channel: 'chrome', headless: true }); report.browser = browser.version();
    const pages = [];
    for (let index = 0; index < 4; index++) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
      const page = await context.newPage(); page.setDefaultTimeout(15000);
      page.on('pageerror', error => report.pageErrors.push(sanitized(error)));
      page.on('response', response => {
        const request = response.request(); const url = new URL(response.url());
        if (url.pathname.startsWith('/api/products')) report.productRequests.push({ actor: index, method: request.method(), path: url.pathname, status: response.status() });
      }); pages.push(page);
    }
    [seller, other, buyer, anonymous] = pages;
    await check('SETUP-01', 'Three real registrations and independent role sessions', 'real UI/API/DB', async row => {
      await register(seller, 'seller', emails[0], 'WF1 Seller A'); await login(seller, emails[0], '/seller/products');
      await register(other, 'seller', emails[1], 'WF1 Seller B'); await login(other, emails[1], '/seller/products');
      await register(buyer, 'buyer', emails[2], 'WF1 Buyer A'); await login(buyer, emails[2], '/products');
      await heading(other, 'You have not published any products yet.');
      row.accounts = (await User.find({ email: { $in: emails } }).select('_id role').lean()).map(user => ({ id: String(user._id), role: user.role }));
      assert.equal(row.accounts.length, 3); await screenshot(other, '01-seller-empty');
    });
    await check('SEC-01', 'Protected create route restores the allowed path after sign-in', 'real UI/API', async () => {
      await anonymous.goto(base + '/seller/products/new'); await anonymous.waitForURL('**/login');
      await login(anonymous, emails[1], '/seller/products/new'); await heading(anonymous, 'Create product');
      await anonymous.getByRole('button', { name: 'Sign out', exact: true }).click();
    });
    await check('VAL-UI', 'Invalid form preserves fields, focuses the amount and sends no POST', 'real UI', async () => {
      await seller.getByRole('link', { name: 'Create product', exact: true }).click();
      await fillProduct(seller, title, '1.234');
      const before = report.productRequests.filter(row => row.method === 'POST').length;
      await seller.getByRole('button', { name: 'Publish product', exact: true }).click();
      await seller.getByRole('alert').filter({ hasText: 'Please check the highlighted fields.' }).waitFor();
      assert.equal(await seller.getByLabel('Price (AUD)', { exact: true }).inputValue(), '1.234');
      assert.equal(await seller.evaluate(() => document.activeElement.id), 'product-price');
      assert.equal(report.productRequests.filter(row => row.method === 'POST').length, before);
      await screenshot(seller, '02-form-validation');
    });
    await check('WF1-01', 'Seller publishes AUD 25.00 and reads a server-owned persisted record', 'real UI/API/DB', async row => {
      await seller.getByLabel('Price (AUD)', { exact: true }).fill('25.00');
      const response = seller.waitForResponse(response => response.url().endsWith('/api/products') && response.request().method() === 'POST');
      await seller.getByRole('button', { name: 'Publish product', exact: true }).click();
      const created = await response; assert.equal(created.status(), 201); mainProduct = (await created.json()).product;
      assert.deepEqual(Object.keys(created.request().postDataJSON()).sort(), ['category', 'description', 'priceCents', 'title']);
      await seller.getByText('Product published.', { exact: true }).waitFor(); await card(seller, title).waitFor();
      row.product = mainProduct; row.database = await productSnapshot(mainProduct.id);
      assert.equal(row.database.priceCents, 2500); assert.equal(row.database.status, 'active');
      assert.equal(row.database.sellerId, String((await User.findOne({ email: emails[0] }))._id));
      await screenshot(seller, '03-seller-published');
    });
    await check('WF1-02', 'Buyer sees the saved catalogue and detail at AUD 25.00', 'real UI/API', async () => {
      await buyer.getByRole('button', { name: 'Reload products', exact: true }).click();
      await card(buyer, title).getByText('AUD 25.00', { exact: true }).waitFor(); await screenshot(buyer, '04-buyer-catalogue');
      await card(buyer, title).getByRole('link', { name: 'View details', exact: true }).click();
      await heading(buyer, title); await buyer.getByText('AUD 25.00', { exact: true }).waitFor(); await screenshot(buyer, '05-buyer-detail');
    });
    await check('WF1-03', 'Refresh and sign-in preserve the saved product and consume the old success notice', 'real UI/API/DB', async () => {
      await seller.reload(); await card(seller, title).waitFor(); assert.equal(await seller.getByText('Product published.', { exact: true }).count(), 0);
      await seller.getByRole('button', { name: 'Sign out', exact: true }).click(); await login(seller, emails[0], '/seller/products');
      await card(seller, title).waitFor(); assert.equal((await productSnapshot(mainProduct.id)).priceCents, 2500);
    });
    await check('WF1-04', 'Owner updates the saved price to AUD 30.00', 'real UI/API/DB', async row => {
      await card(seller, title).getByRole('link', { name: 'Edit', exact: true }).click();
      await seller.getByLabel('Title', { exact: true }).fill(changedTitle); await seller.getByLabel('Price (AUD)', { exact: true }).fill('30.00');
      await seller.getByRole('button', { name: 'Save changes', exact: true }).click(); await seller.getByText('Product updated.', { exact: true }).waitFor();
      await card(seller, changedTitle).getByText('AUD 30.00', { exact: true }).waitFor();
      row.database = await productSnapshot(mainProduct.id); assert.equal(row.database.priceCents, 3000); assert.equal(row.database.sellerId, mainProduct.sellerId);
      await screenshot(seller, '06-seller-updated');
    });
    await check('WF1-05', 'Buyer reload reads the saved updated values', 'real UI/API', async () => {
      await buyer.getByRole('button', { name: 'Reload details', exact: true }).click(); await heading(buyer, changedTitle);
      await buyer.getByText('AUD 30.00', { exact: true }).waitFor(); await screenshot(buyer, '07-buyer-updated');
    });
    await check('SEC-02-06', 'Buyer and another Seller cannot write; full record and collection count remain unchanged', 'real UI/API/DB', async row => {
      await buyer.goto(base + '/seller/products/new'); await heading(buyer, 'You do not have access to this page'); assert.equal(await signedIn(buyer), true);
      await other.goto(base + `/seller/products/${mainProduct.id}/edit`); await heading(other, 'You do not have access to edit this product');
      const before = await productSnapshot(mainProduct.id); const beforeCount = await Product.countDocuments({});
      const outcomes = [];
      for (const [method, url, payload, page, expected] of [
        ['POST', '/api/products', values, null, 401], ['PATCH', `/api/products/${mainProduct.id}`, { priceCents: 1 }, null, 401],
        ['POST', '/api/products', values, buyer, 403], ['PATCH', `/api/products/${mainProduct.id}`, { priceCents: 1 }, buyer, 403],
        ['PATCH', `/api/products/${mainProduct.id}`, { priceCents: 1 }, other, 403], ['PATCH', `/api/products/${mainProduct.id}`, { status: 'archived' }, other, 403],
      ]) { const result = await call(method, url, payload, page); assert.equal(result.status, expected); outcomes.push({ method, url, ...result }); }
      row.before = before; row.after = await productSnapshot(mainProduct.id); row.beforeCount = beforeCount; row.afterCount = await Product.countDocuments({}); row.responses = outcomes;
      assert.deepEqual(row.after, before); assert.equal(row.afterCount, beforeCount); assert.equal(await signedIn(buyer), true); assert.equal(await signedIn(other), true);
      await screenshot(other, '08-other-owner-denied');
    });
    await check('VAL-API', 'Invalid fields, unsafe/typed amounts and forged ownership are rejected without writes', 'real API/DB', async row => {
      const before = await productSnapshot(mainProduct.id); const count = await Product.countDocuments({}); row.responses = [];
      for (const changes of [{ title: ' ' }, { title: 'x'.repeat(121) }, { description: '' }, { category: 'x'.repeat(61) }, { priceCents: 0 }, { priceCents: '2500' }, { priceCents: Number.MAX_SAFE_INTEGER + 1 }, { sellerId: mainProduct.sellerId }, { imagePath: '/a.png' }, { status: 'active' }]) {
        const result = await call('PATCH', `/api/products/${mainProduct.id}`, changes, seller); assert.equal(result.status, 400); row.responses.push({ fields: Object.keys(changes), ...result });
      }
      row.before = before; row.after = await productSnapshot(mainProduct.id); row.beforeCount = count; row.afterCount = await Product.countDocuments({});
      assert.deepEqual(row.after, before); assert.equal(row.afterCount, count);
    });
    await check('UX-READ', 'Loading, read failure and explicit retry are distinct from empty', 'controlled delay/failure; recovery uses real API', async () => {
      let release; const gate = new Promise(resolve => { release = resolve; });
      await anonymous.route('**/api/products', async route => { await gate; try { await route.continue(); } catch { /* Navigation may cancel an older read. */ } });
      await anonymous.goto(base + '/products', { waitUntil: 'domcontentloaded' }); await anonymous.getByRole('status').filter({ hasText: 'Loading products' }).waitFor();
      await screenshot(anonymous, '09-loading'); release(); await card(anonymous, changedTitle).waitFor(); await anonymous.unroute('**/api/products');
      await anonymous.route('**/api/products', route => route.abort('failed')); await anonymous.getByRole('button', { name: 'Reload products', exact: true }).click();
      await heading(anonymous, 'We could not load products'); assert.equal(await anonymous.getByText('No products are available yet.', { exact: true }).count(), 0); await screenshot(anonymous, '10-read-error');
      await anonymous.unroute('**/api/products'); await anonymous.getByRole('button', { name: 'Retry', exact: true }).click(); await card(anonymous, changedTitle).waitFor();
    });
    await check('UX-EMPTY', 'Public empty state is rendered without deleting database records', 'injected empty response', async () => {
      await anonymous.route('**/api/products', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"products":[]}' }));
      await anonymous.getByRole('button', { name: 'Reload products', exact: true }).click(); await heading(anonymous, 'No products are available yet.');
      await screenshot(anonymous, '11-public-empty-simulated'); await anonymous.unroute('**/api/products');
    });
    await check('READ-01', 'Malformed and missing IDs have distinct 400 and 404 UI states', 'real UI/API', async () => {
      await anonymous.goto(base + '/products/not-an-id'); await heading(anonymous, 'Invalid product link');
      await anonymous.goto(base + '/products/000000000000000000000000'); await heading(anonymous, 'Product not available'); await screenshot(anonymous, '12-product-unavailable');
    });
    await check('UX-SERVER-FIELD', 'Server field feedback preserves the submitted draft', 'injected validation response', async () => {
      await seller.goto(base + '/seller/products/new'); await fillProduct(seller, unknownTitle);
      await seller.route('**/api/products', route => route.request().method() === 'POST' ? route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: 'VALIDATION_ERROR', message: 'Please check the highlighted fields.', errors: { priceCents: 'Please check this price.' } }) }) : route.continue());
      await seller.getByRole('button', { name: 'Publish product', exact: true }).click(); await seller.getByText('Please check this price.', { exact: true }).waitFor();
      assert.equal(await seller.getByLabel('Title', { exact: true }).inputValue(), unknownTitle); assert.equal(await seller.getByLabel('Price (AUD)', { exact: true }).getAttribute('aria-invalid'), 'true');
      await screenshot(seller, '13-server-field-error-simulated'); await seller.unroute('**/api/products');
    });
    await check('UX-UNCONFIRMED', 'A committed write with a lost browser response is reconciled without an automatic duplicate', 'real POST/DB; browser response deliberately aborted', async row => {
      const beforeCount = await Product.countDocuments({}); let attempts = 0;
      await seller.route('**/api/products', async route => {
        if (route.request().method() !== 'POST') return route.continue();
        attempts++; const response = await route.fetch(); assert.equal(response.status(), 201); unknownProduct = (await response.json()).product;
        await route.abort('failed');
      });
      await seller.getByRole('button', { name: 'Publish product', exact: true }).click(); await seller.getByText('We could not confirm the result. Check My products before submitting again.', { exact: true }).waitFor();
      assert.equal(await seller.getByLabel('Title', { exact: true }).inputValue(), unknownTitle); await screenshot(seller, '14-unconfirmed-write');
      await seller.unroute('**/api/products'); await seller.getByRole('link', { name: 'Check My products', exact: true }).click(); await card(seller, unknownTitle).waitFor();
      row.beforeCount = beforeCount; row.afterCount = await Product.countDocuments({}); row.postAttempts = attempts; row.product = await productSnapshot(unknownProduct.id);
      assert.equal(attempts, 1); assert.equal(row.afterCount, beforeCount + 1);
    });
    await check('SES-403', 'Ordinary UI API 403 preserves the valid session and retries', 'injected FORBIDDEN response; real recovery', async () => {
      await other.goto(base + '/seller/products'); await heading(other, 'You have not published any products yet.');
      await other.route('**/api/products/mine', route => route.fulfill({ status: 403, contentType: 'application/json', body: '{"code":"FORBIDDEN","message":"You do not have access."}' }));
      await other.getByRole('button', { name: 'Reload My products', exact: true }).click(); await heading(other, 'You do not have access');
      assert.equal(await signedIn(other), true); await other.unroute('**/api/products/mine'); await other.getByRole('button', { name: 'Retry', exact: true }).click(); await heading(other, 'You have not published any products yet.');
    });
    await check('RACE-01', 'A delayed Seller A list cannot populate Seller B after sign-out', 'controlled real-response delay', async () => {
      let release; let held; const gate = new Promise(resolve => { release = resolve; }); const seen = new Promise(resolve => { held = resolve; }); let first = true;
      await seller.route('**/api/products/mine', async route => {
        if (!first) return route.continue(); first = false; const response = await route.fetch(); held(); await gate;
        try { await route.fulfill({ response }); } catch { /* The old session's request should be cancelled. */ }
      });
      await seller.getByRole('button', { name: 'Reload My products', exact: true }).click(); await seen;
      await seller.getByRole('button', { name: 'Sign out', exact: true }).click(); await login(seller, emails[1], '/seller/products'); await heading(seller, 'You have not published any products yet.');
      release(); await sleep(250); assert.equal(await card(seller, changedTitle).count(), 0); await screenshot(seller, '15-session-switch-isolated'); await seller.unroute('**/api/products/mine');
      await seller.getByRole('button', { name: 'Sign out', exact: true }).click(); await login(seller, emails[0], '/seller/products'); await card(seller, changedTitle).waitFor();
    });
    await check('RACE-03', 'Leaving a delayed detail read does not replace a newer product', 'controlled real-response delay', async () => {
      let release; const gate = new Promise(resolve => { release = resolve; });
      await anonymous.route(`**/api/products/${mainProduct.id}`, async route => { const response = await route.fetch(); await gate; try { await route.fulfill({ response }); } catch { /* Older read cancelled. */ } });
      await anonymous.goto(base + `/products/${mainProduct.id}`, { waitUntil: 'domcontentloaded' }); await anonymous.getByRole('status').filter({ hasText: 'Loading products' }).waitFor();
      await anonymous.getByRole('link', { name: 'Browse products', exact: true }).click(); await card(anonymous, unknownTitle).getByRole('link', { name: 'View details', exact: true }).click(); await heading(anonymous, unknownTitle);
      release(); await sleep(250); await heading(anonymous, unknownTitle); assert.equal(await anonymous.getByRole('heading', { name: changedTitle, exact: true }).count(), 0); await anonymous.unroute(`**/api/products/${mainProduct.id}`);
    });
    await check('RACE-02', 'Archive while editing returns 409, preserves the draft and reloads read-only history', 'real UI/API/DB', async row => {
      const created = await call('POST', '/api/products', { ...values, title: `Conflict ${prefix}` }, seller); assert.equal(created.status, 201); const id = created.body.product.id;
      await seller.goto(base + `/seller/products/${id}/edit`); await seller.getByLabel('Title', { exact: true }).fill('Unsent conflict draft');
      assert.equal((await call('PATCH', `/api/products/${id}`, { status: 'archived' }, seller)).status, 200);
      await seller.getByRole('button', { name: 'Save changes', exact: true }).click(); await seller.getByText('Latest status: archived.', { exact: true }).waitFor();
      assert.equal(await seller.getByLabel('Title', { exact: true }).inputValue(), 'Unsent conflict draft'); assert.equal(await seller.getByRole('button', { name: 'Save changes', exact: true }).isDisabled(), true);
      await screenshot(seller, '16-conflict-preserved-draft');
      await seller.getByRole('button', { name: 'Discard draft and reload latest', exact: true }).click(); await heading(seller, 'This product is archived');
      row.database = await productSnapshot(id); assert.notEqual(row.database.title, 'Unsent conflict draft');
    });
    await check('WF1-06', 'Archive cancel and Escape send no PATCH and restore keyboard focus', 'real UI/API', async row => {
      await seller.goto(base + '/seller/products'); const target = card(seller, changedTitle);
      const before = report.productRequests.filter(item => item.method === 'PATCH').length;
      await target.getByRole('button', { name: 'Archive', exact: true }).click(); await heading(seller, 'Archive this product?');
      assert.equal(await seller.evaluate(() => document.activeElement.textContent), 'Cancel archive'); await screenshot(seller, '17-archive-confirmation');
      await seller.getByRole('button', { name: 'Cancel archive', exact: true }).click();
      assert.equal(await seller.evaluate(() => document.activeElement.textContent), 'Archive');
      await target.getByRole('button', { name: 'Archive', exact: true }).click(); await seller.keyboard.press('Escape');
      assert.equal(await seller.getByRole('heading', { name: 'Archive this product?', exact: true }).count(), 0);
      row.beforePatchCount = before; row.afterPatchCount = report.productRequests.filter(item => item.method === 'PATCH').length; assert.equal(row.afterPatchCount, before);
      assert.equal((await productSnapshot(mainProduct.id)).status, 'active');
    });
    await check('WF1-07', 'Confirmed archive retains the owner record and removes edit actions', 'real UI/API/DB', async row => {
      await card(seller, changedTitle).getByRole('button', { name: 'Archive', exact: true }).click(); await seller.getByRole('button', { name: 'Confirm archive', exact: true }).click();
      await seller.getByText('Product archived. It remains in your history.', { exact: true }).waitFor(); await card(seller, changedTitle).getByText('Archived', { exact: true }).waitFor();
      assert.equal(await card(seller, changedTitle).getByRole('link', { name: 'Edit', exact: true }).count(), 0);
      row.database = await productSnapshot(mainProduct.id); assert.equal(row.database.status, 'archived'); assert.equal(row.database.priceCents, 3000); await screenshot(seller, '18-owner-archived');
    });
    await check('WF1-08', 'Buyer, anonymous and other-owner reads cannot expose an archived product', 'real UI/API', async row => {
      await buyer.goto(base + '/products'); await card(buyer, unknownTitle).waitFor(); assert.equal(await card(buyer, changedTitle).count(), 0);
      await buyer.goto(base + `/products/${mainProduct.id}`); await heading(buyer, 'Product not available'); await screenshot(buyer, '19-buyer-archived-unavailable');
      row.responses = [];
      for (const person of [buyer, null, other]) { const result = await call('GET', `/api/products/${mainProduct.id}`, undefined, person); assert.equal(result.status, 404); row.responses.push(result); }
      const list = await call('GET', '/api/products'); assert.equal(list.body.products.some(item => item.id === mainProduct.id), false);
    });
    await check('WF1-09', 'Owner re-login reads archived history and archived writes remain rejected', 'real UI/API/DB', async row => {
      await seller.getByRole('button', { name: 'Sign out', exact: true }).click(); await login(seller, emails[0], '/seller/products');
      await card(seller, changedTitle).getByRole('link', { name: 'View details', exact: true }).click(); await heading(seller, changedTitle); await seller.getByText('This product is archived. It is retained in your history and cannot be edited or reopened.', { exact: true }).waitFor();
      row.responses = [];
      for (const [payload, status] of [[{ priceCents: 4000 }, 409], [{ status: 'archived' }, 409], [{ status: 'active' }, 400]]) { const result = await call('PATCH', `/api/products/${mainProduct.id}`, payload, seller); assert.equal(result.status, status); row.responses.push(result); }
      assert.equal((await productSnapshot(mainProduct.id)).priceCents, 3000);
    });
    await check('WF1-10', 'A genuine backend process replacement retains saved active and archived data', 'real process restart/UI/API/DB', async row => {
      row.pidBefore = backend.pid; await stopBackend(); row.pidAfter = await startBackend(); report.backendPidAfterRestart = row.pidAfter; assert.notEqual(row.pidAfter, row.pidBefore);
      await seller.reload(); await heading(seller, changedTitle); await seller.getByText('AUD 30.00', { exact: true }).waitFor();
      await buyer.goto(base + `/products/${unknownProduct.id}`); await heading(buyer, unknownTitle); await buyer.getByText('AUD 25.00', { exact: true }).waitFor();
      row.archived = await productSnapshot(mainProduct.id); row.active = await productSnapshot(unknownProduct.id);
      assert.equal(row.archived.status, 'archived'); assert.equal(row.active.status, 'active'); await screenshot(seller, '20-restarted-owner-history');
    });
    await check('UX-RESPONSIVE', '390px and 1024px pages retain readable layouts and keyboard-labelled controls', 'real browser layout', async row => {
      row.widths = [];
      for (const width of [390, 1024]) {
        await seller.setViewportSize({ width, height: 1000 }); await seller.goto(base + '/seller/products'); await card(seller, changedTitle).waitFor();
        const overflow = await seller.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth); assert.equal(overflow, false); row.widths.push({ width, overflow });
        await screenshot(seller, `21-seller-${width}`);
        await seller.getByRole('link', { name: 'Create product', exact: true }).click(); await seller.getByLabel('Title', { exact: true }).fill('Keyboard craft');
        await seller.getByLabel('Title', { exact: true }).focus(); await seller.keyboard.press('Tab'); assert.equal(await seller.evaluate(() => document.activeElement.id), 'product-description');
        assert.equal(await seller.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false); await screenshot(seller, `22-form-${width}`);
      }
    });
    await check('SES-ROLE', 'Account-role-unavailable clears session through the existing interceptor', 'injected role-unavailable response', async () => {
      await buyer.goto(base + '/products'); await card(buyer, unknownTitle).waitFor(); let first = true;
      await buyer.route('**/api/products', route => { if (!first) return route.continue(); first = false; return route.fulfill({ status: 403, contentType: 'application/json', body: '{"code":"ACCOUNT_ROLE_UNAVAILABLE","message":"Account access is unavailable."}' }); });
      await buyer.getByRole('button', { name: 'Reload products', exact: true }).click(); await buyer.getByRole('link', { name: 'Sign in', exact: true }).waitFor(); assert.equal(await signedIn(buyer), false); await buyer.unroute('**/api/products');
    });
    await check('SES-401', 'A deleted fixture account is rejected by a real Product request and loses its session', 'real UI/API/DB', async row => {
      await other.goto(base + '/seller/products'); await heading(other, 'You have not published any products yet.');
      await User.deleteOne({ email: emails[1] }); await other.getByRole('button', { name: 'Reload My products', exact: true }).click(); await other.waitForURL('**/login'); assert.equal(await signedIn(other), false);
      const invalidToken = await call('GET', '/api/products', undefined, null, 'invalid-token'); assert.equal(invalidToken.status, 401); row.invalidTokenPublicRead = invalidToken;
      await screenshot(other, '23-session-expired');
    });
    assert.deepEqual(report.pageErrors, []);
    report.status = 'pass';
  } catch (error) {
    report.status = 'fail'; report.error = sanitized(error); console.error('FAIL ' + sanitized(error)); process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    try { report.cleanup = await cleanProductFixtures(emails); }
    catch (error) { report.cleanup = sanitized(error); process.exitCode = 1; }
    await stopBackend(); await mongoose.disconnect(); report.finishedAt = new Date().toISOString(); save();
    console.log(`Recorded ${report.cases.filter(row => row.status === 'pass').length}/${report.cases.length} passing cases; fixture cleanup recorded.`);
  }
})();
