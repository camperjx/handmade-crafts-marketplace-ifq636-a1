// Optional browser verifier: install Playwright separately and set
// S07_PLAYWRIGHT_MODULE. This never uses a personal Chrome profile or exports HAR.
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const { randomUUID, randomBytes } = require('crypto');
const { chromium } = require(process.env.S07_PLAYWRIGHT_MODULE || 'playwright');
const mongoose = require('../../backend/node_modules/mongoose');
require('../../backend/node_modules/dotenv').config({ path: path.resolve(__dirname, '../../backend/.env') });
const User = require('../../backend/models/User');

const base = process.env.S07_FRONTEND_URL || 'http://localhost:3001';
const output = path.resolve(process.env.S07_ARTIFACT_DIR || 'artifacts/s07-browser');
fs.mkdirSync(output, { recursive: true });
const key = 'hm.auth.token.v1';
const prefix = 's07-browser-' + randomUUID();
const password = randomBytes(18).toString('hex');
const emails = ['buyer', 'seller'].map(role => prefix + '-' + role + '@example.com');
const report = { startedAt: new Date().toISOString(), timezone: 'Australia/Brisbane', kind: 'Actual Chrome automation against the app and configured development MongoDB; injected failure cases explicitly identified', frontend: base, cases: [], pageErrors: [], cleanup: 'pending' };
let browser, buyerPage, sellerPage, currentCase;
const waitHeading = (page, name) => page.getByRole('heading', { name, exact: true }).waitFor();
const screenshot = (page, name) => page.screenshot({ path: path.join(output, name + '.png'), fullPage: true });
const signedIn = page => page.evaluate(k => Boolean(sessionStorage.getItem(k)), key);
async function check(id, title, action) {
  currentCase = { id, title, status: 'running' }; report.cases.push(currentCase);
  await action(); currentCase.status = 'pass'; console.log('PASS ' + id + ' ' + title);
}
async function register(page, role, email) {
  await page.goto(base + '/register'); await page.getByRole('radio', { name: role === 'buyer' ? 'Buyer' : 'Seller', exact: true }).check();
  await page.getByLabel('Name', { exact: true }).fill('S07 ' + role);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  if (role === 'seller') await screenshot(page, 's07-01-register-seller');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.waitForURL('**/login'); await page.getByText('Your account is ready. Please sign in.', { exact: true }).waitFor();
  assert.equal(await signedIn(page), false);
}
async function login(page, email, destination) {
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL(base + destination);
}

(async () => {
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true }); report.browser = browser.version();
    const buyerContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const sellerContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    buyerPage = await buyerContext.newPage(); sellerPage = await sellerContext.newPage();
    for (const page of [buyerPage, sellerPage]) {
      page.setDefaultTimeout(15000);
      page.on('pageerror', error => report.pageErrors.push(error.message.replaceAll(password, '[redacted]')));
    }
    await check('UI01', 'Unauthenticated protected page requires sign-in', async () => {
      await buyerPage.goto(base + '/profile'); await buyerPage.waitForURL('**/login'); await waitHeading(buyerPage, 'Welcome back');
    });
    await check('UI02', 'Both registration role choices persist without automatically signing in', async () => {
      await register(buyerPage, 'buyer', emails[0]); await register(sellerPage, 'seller', emails[1]);
    });
    await check('UI08', 'Wrong password has visible feedback and creates no session', async () => {
      await buyerPage.getByLabel('Email', { exact: true }).fill(emails[0]); await buyerPage.getByLabel('Password', { exact: true }).fill('intentionally wrong password');
      await buyerPage.getByRole('button', { name: 'Sign in', exact: true }).click();
      await buyerPage.getByRole('alert').filter({ hasText: 'Email or password is incorrect.' }).waitFor();
      assert.equal(await signedIn(buyerPage), false); await screenshot(buyerPage, 's07-03-login-rejection');
    });
    await check('UI03', 'Buyer and Seller land on their own account areas', async () => {
      await login(buyerPage, emails[0], '/products'); await waitHeading(buyerPage, 'Explore handmade products');
      await login(sellerPage, emails[1], '/seller/products'); await waitHeading(sellerPage, 'My products');
      await screenshot(sellerPage, 's07-02-seller-navigation');
      const storedKeys = await buyerPage.evaluate(() => Object.keys(sessionStorage).filter(k => k.startsWith('hm.')));
      assert.deepEqual(storedKeys, [key]);
    });
    await check('UI04', 'Buyer cannot render the Seller area', async () => {
      await buyerPage.goto(base + '/seller/products'); await waitHeading(buyerPage, 'You do not have access to this page');
      assert.equal(await signedIn(buyerPage), true); await screenshot(buyerPage, 's07-04-buyer-access-denied');
    });
    await check('UI09', 'Profile update is saved using the real API', async () => {
      await buyerPage.goto(base + '/profile'); await buyerPage.getByLabel('Name', { exact: true }).fill('S07 Buyer Updated');
      await buyerPage.getByLabel('Address (optional)', { exact: true }).fill('Brisbane');
      await buyerPage.getByRole('button', { name: 'Save profile', exact: true }).click();
      await buyerPage.getByText('Your profile has been saved.', { exact: true }).waitFor();
    });
    await check('UI05', 'Refresh verifies profile and retains the saved DB values', async () => {
      let reads = 0; const count = response => { if (response.url().endsWith('/api/auth/profile') && response.request().method() === 'GET' && response.status() === 200) reads++; };
      buyerPage.on('response', count); await buyerPage.reload(); await buyerPage.getByLabel('Name', { exact: true }).waitFor();
      assert.equal(await buyerPage.getByLabel('Name', { exact: true }).inputValue(), 'S07 Buyer Updated');
      assert.ok(reads >= 1); report.profileReadsOnRefresh = reads; buyerPage.off('response', count);
      await screenshot(buyerPage, 's07-05-refreshed-profile');
    });
    await check('UI10', 'Injected network failure blocks restoration, preserves token and retries', async () => {
      await buyerPage.route('**/api/auth/profile', route => route.abort('failed'));
      await buyerPage.reload(); await waitHeading(buyerPage, 'We could not confirm your sign-in');
      assert.equal(await signedIn(buyerPage), true); await screenshot(buyerPage, 's07-06-network-failure');
      await buyerPage.unroute('**/api/auth/profile'); await buyerPage.getByRole('button', { name: 'Try again', exact: true }).click();
      await buyerPage.getByLabel('Name', { exact: true }).waitFor(); assert.equal(await buyerPage.getByLabel('Name', { exact: true }).inputValue(), 'S07 Buyer Updated');
    });
    await check('UI06', 'A tampered saved token is rejected and removed', async () => {
      await buyerPage.evaluate(k => sessionStorage.setItem(k, 'invalid-s07-token'), key); await buyerPage.reload();
      await buyerPage.waitForURL('**/login'); await waitHeading(buyerPage, 'Welcome back'); assert.equal(await signedIn(buyerPage), false);
      await screenshot(buyerPage, 's07-07-invalid-session');
    });
    await check('UI07', 'Logout and a protected return require a new sign-in', async () => {
      await login(buyerPage, emails[0], '/profile'); await buyerPage.getByLabel('Name', { exact: true }).waitFor();
      await buyerPage.getByRole('button', { name: 'Sign out', exact: true }).click(); await buyerPage.waitForURL('**/login');
      assert.equal(await signedIn(buyerPage), false); await buyerPage.goBack();
      await buyerPage.goto(base + '/profile'); await buyerPage.waitForURL('**/login');
      assert.equal(await buyerPage.getByRole('link', { name: 'Profile', exact: true }).count(), 0);
    });
    await check('UI11', 'A delayed profile cannot restore a session after it is cleared', async () => {
      await login(buyerPage, emails[0], '/profile'); await buyerPage.getByLabel('Name', { exact: true }).waitFor();
      let release, started, completed;
      const gate = new Promise(resolve => { release = resolve; });
      const requestStarted = new Promise(resolve => { started = resolve; });
      const requestCompleted = new Promise(resolve => { completed = resolve; });
      await buyerPage.route('**/api/auth/profile', async route => {
        started();
        try { const response = await route.fetch(); await gate; await route.fulfill({ response }); }
        catch { /* Request was cancelled by logout. */ }
        finally { completed(); }
      });
      await buyerPage.reload(); await waitHeading(buyerPage, 'Checking your sign-in…');
      await requestStarted;
      await buyerPage.getByRole('button', { name: 'Sign in again', exact: true }).click();
      await buyerPage.waitForURL('**/login'); release(); await requestCompleted;
      await buyerPage.unroute('**/api/auth/profile');
      await waitHeading(buyerPage, 'Welcome back'); assert.equal(await signedIn(buyerPage), false);
    });
    await check('UI12', 'Seller refresh restores the correct role without runtime page errors', async () => {
      await sellerPage.reload(); await waitHeading(sellerPage, 'My products'); assert.equal(await signedIn(sellerPage), true);
      assert.deepEqual(report.pageErrors, []);
    });
    await check('UI13', 'Labels, keyboard focus and narrow layouts remain usable', async () => {
      await sellerPage.setViewportSize({ width: 1024, height: 900 }); await sellerPage.goto(base + '/profile'); await sellerPage.getByLabel('Name', { exact: true }).waitFor();
      assert.equal(await sellerPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
      await sellerPage.setViewportSize({ width: 390, height: 844 });
      assert.equal(await sellerPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
      await sellerPage.getByLabel('Name', { exact: true }).focus(); await sellerPage.keyboard.press('Tab');
      assert.equal(await sellerPage.getByLabel('Email', { exact: true }).evaluate(element => element === document.activeElement), true);
      await screenshot(sellerPage, 's07-08-mobile-profile');
      await buyerPage.goto(base + '/not-a-route'); await waitHeading(buyerPage, 'Page not found');
    });
    await check('UI14', 'A persisted role invalidation clears an active SPA session', async () => {
      mongoose.set('strictQuery', true);
      await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
      const account = await User.findOne({ email: emails[1] }).lean();
      assert.ok(account);
      await sellerPage.getByRole('link', { name: 'Browse products', exact: true }).click();
      await waitHeading(sellerPage, 'Explore handmade products');
      await User.collection.updateOne({ _id: account._id, email: emails[1] }, { $unset: { role: '' } });
      await sellerPage.getByRole('link', { name: 'Profile', exact: true }).click();
      await sellerPage.waitForURL('**/login'); await waitHeading(sellerPage, 'Welcome back');
      assert.equal(await signedIn(sellerPage), false);
      await screenshot(sellerPage, 's07-09-account-role-invalidated');
    });
    report.result = 'pass';
  } catch (error) {
    report.result = 'fail'; if (currentCase) currentCase.status = 'fail';
    report.error = String(error.message).replaceAll(password, '[redacted]');
    if (buyerPage) await screenshot(buyerPage, 's07-failure').catch(() => {});
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    try {
      mongoose.set('strictQuery', true); await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
      await User.deleteMany({ email: { $in: emails } });
      assert.equal(await User.countDocuments({ email: { $in: emails } }), 0); report.cleanup = 'all dedicated browser accounts removed';
    } catch { report.cleanup = 'failed; inspect the dedicated run prefix'; process.exitCode = 1; }
    finally { await mongoose.disconnect(); }
    report.completedAt = new Date().toISOString();
    fs.writeFileSync(path.join(output, 'browser-results.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ result: report.result, passed: report.cases.filter(c => c.status === 'pass').length, cleanup: report.cleanup, error: report.error || null }));
  }
})();
