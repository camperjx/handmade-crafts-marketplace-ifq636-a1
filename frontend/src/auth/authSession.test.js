import axios from 'axios';
import { accountFrom, createAuthSession, TOKEN_KEY } from './authSession';
const buyer = { id: '1'.repeat(24), name: 'Buyer', email: 'buyer@example.com', role: 'buyer', address: '' };
const seller = { ...buyer, id: '2'.repeat(24), name: 'Seller', role: 'seller' };
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
function harness(saved = null, overrideStorage) {
  const values = new Map(saved ? [[TOKEN_KEY, saved]] : []);
  const storage = overrideStorage || { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const requests = [];
  const api = axios.create({ adapter: config => new Promise((resolve, reject) => requests.push({ config, resolve, reject })) });
  const session = createAuthSession(api, jest.fn(), storage);
  const next = async () => { for (let i = 0; i < 20; i++) { if (requests.length) return requests.shift(); await tick(); } throw new Error('Expected an API request'); };
  const finish = (request, status, data) => {
    const response = { status, data, config: request.config, headers: {} };
    if (status >= 400) { const error = new Error('Test request rejected'); error.config = request.config; error.response = response; request.reject(error); }
    else request.resolve(response);
  };
  const authenticate = async () => { await session.start(); const promise = session.login({ email: buyer.email, password: 'test input' }); finish(await next(), 200, { ...buyer, token: 'test-buyer-token' }); await promise; };
  return { api, session, storage, requests, next, finish, authenticate };
}
test('no token starts anonymous without a profile request', async () => {
  const h = harness(); await h.session.start(); expect(h.session.getSnapshot().status).toBe('anonymous'); expect(h.requests).toHaveLength(0); h.session.stop();
});
test('a stored token grants no access until profile verification succeeds', async () => {
  const h = harness('saved-token'); const started = h.session.start(); const request = await h.next();
  expect(h.session.getSnapshot()).toMatchObject({ status: 'initializing', user: null });
  expect(request.config.headers.get('Authorization')).toBe('Bearer saved-token');
  h.finish(request, 200, { ...buyer, password: 'never expose this field' }); await started;
  expect(h.session.getSnapshot().user).toEqual(buyer); h.session.stop();
});
test('profile 401 clears storage and stops access', async () => {
  const h = harness('invalid-token'); const started = h.session.start(); h.finish(await h.next(), 401, {}); await started;
  expect(h.storage.getItem(TOKEN_KEY)).toBeNull(); expect(h.session.getSnapshot().status).toBe('anonymous'); h.session.stop();
});
test('profile service failure retains the token without granting access and can retry', async () => {
  const h = harness('saved-token'); const started = h.session.start(); h.finish(await h.next(), 500, {}); await started;
  expect(h.session.getSnapshot()).toMatchObject({ status: 'unavailable', user: null }); expect(h.storage.getItem(TOKEN_KEY)).toBe('saved-token');
  const retry = h.session.refreshSession(); h.finish(await h.next(), 200, buyer); await retry;
  expect(h.session.getSnapshot().status).toBe('authenticated'); h.session.stop();
});
test('network failure also blocks restoration without discarding the token', async () => {
  const h = harness('saved-token'); const started = h.session.start(); (await h.next()).reject(new Error('Simulated network failure')); await started;
  expect(h.session.getSnapshot().status).toBe('unavailable'); expect(h.storage.getItem(TOKEN_KEY)).toBe('saved-token'); h.session.stop();
});
test('a wrong-password 401 remains a login error with no session', async () => {
  const h = harness(); await h.session.start(); const login = h.session.login({ email: buyer.email, password: 'wrong input' });
  const failure = expect(login).rejects.toThrow(); const request = await h.next(); expect(request.config._hmProtected).toBeUndefined();
  h.finish(request, 401, {}); await failure; expect(h.session.getSnapshot().status).toBe('anonymous'); expect(h.storage.getItem(TOKEN_KEY)).toBeNull(); h.session.stop();
});
test('a late profile response cannot restore a signed-out account', async () => {
  const h = harness('saved-token'); const started = h.session.start(); const request = await h.next(); h.session.logout();
  h.finish(request, 200, buyer); await started; expect(h.session.getSnapshot()).toMatchObject({ status: 'anonymous', user: null }); h.session.stop();
});
test('a stale protected 401 cannot clear a more recent login', async () => {
  const h = harness(); await h.authenticate();
  const oldRequest = h.api.get('/api/orders/mine').catch(error => error); const pending = await h.next();
  const login = h.session.login({ email: seller.email, password: 'test input' }); h.finish(await h.next(), 200, { ...seller, token: 'new-seller-token' }); await login;
  h.finish(pending, 401, {}); await oldRequest;
  expect(h.session.getSnapshot().user.role).toBe('seller'); expect(h.storage.getItem(TOKEN_KEY)).toBe('new-seller-token'); h.session.stop();
});
test('an ordinary business 403 preserves the valid session', async () => {
  const h = harness(); await h.authenticate(); const request = h.api.post('/api/products', {}).catch(error => error);
  h.finish(await h.next(), 403, { code: 'FORBIDDEN' }); await request; expect(h.session.getSnapshot().user).toEqual(buyer); h.session.stop();
});
test('an unavailable DB account role clears an already authenticated session', async () => {
  const h = harness(); await h.authenticate();
  const request = h.api.get('/api/auth/profile').catch(error => error);
  h.finish(await h.next(), 403, { code: 'ACCOUNT_ROLE_UNAVAILABLE' }); await request;
  expect(h.session.getSnapshot().status).toBe('anonymous');
  expect(h.storage.getItem(TOKEN_KEY)).toBeNull(); h.session.stop();
});
test('unsupported server roles never restore an authenticated session', async () => {
  const h = harness('saved-token'); const started = h.session.start(); h.finish(await h.next(), 200, { ...buyer, role: 'admin' }); await started;
  expect(h.session.getSnapshot().status).toBe('unavailable'); expect(() => accountFrom({ ...buyer, role: 'admin' })).toThrow(); h.session.stop();
});
test('storage denial allows only a clearly described in-memory sign-in', async () => {
  const h = harness(null, { getItem() { throw new Error('Blocked'); }, setItem() { throw new Error('Blocked'); }, removeItem() { throw new Error('Blocked'); } });
  await h.authenticate(); expect(h.session.getSnapshot().status).toBe('authenticated'); expect(h.session.getSnapshot().sessionMessage).toMatch(/refresh/); h.session.stop();
});
test('start/stop/start cleans up interceptors as required by StrictMode', async () => {
  const h = harness(); await h.session.start(); h.session.stop(); await h.session.start();
  expect(h.api.interceptors.request.handlers.filter(Boolean)).toHaveLength(1); expect(h.api.interceptors.response.handlers.filter(Boolean)).toHaveLength(1);
  h.session.stop(); expect(h.api.interceptors.request.handlers.filter(Boolean)).toHaveLength(0);
});
test('profile updates only apply to the current account and revision', async () => {
  const h = harness(); await h.authenticate(); const revision = h.session.getRevision();
  expect(h.session.updateUser({ ...buyer, name: 'Updated' }, revision)).toBe(true);
  expect(h.session.updateUser(seller, revision)).toBe(false); h.session.logout();
  expect(h.session.updateUser(buyer, revision)).toBe(false); h.session.stop();
});
