export const TOKEN_KEY = 'hm.auth.token.v1';
const roles = ['buyer', 'seller'];
export function accountFrom(data) {
  if (!data || typeof data.id !== 'string' || !/^[a-f\d]{24}$/i.test(data.id) ||
      typeof data.name !== 'string' || typeof data.email !== 'string' || !roles.includes(data.role)) {
    throw new Error('The account response could not be verified.');
  }
  return { id: data.id, name: data.name, email: data.email, role: data.role, address: typeof data.address === 'string' ? data.address : '' };
}
function browserStorage() { try { return window.sessionStorage; } catch { return null; } }

// Each Provider owns one controller. Revisions prevent stale requests from
// restoring a signed-out account or clearing a more recent sign-in.
export function createAuthSession(api, onChange, storage = browserStorage()) {
  let active = false, revision = 0, token = null, pending = null;
  let requestInterceptor, responseInterceptor;
  let snapshot = { status: 'initializing', user: null, sessionMessage: '' };
  let storageWorking = Boolean(storage);
  const publish = (status, user = null, sessionMessage = '') => {
    snapshot = { status, user, sessionMessage };
    if (active) onChange(snapshot);
  };
  const advance = () => { revision += 1; if (pending) pending.abort(); pending = null; return revision; };
  const current = attempt => active && attempt === revision;
  const read = () => {
    if (!storageWorking) return token;
    try { return storage.getItem(TOKEN_KEY); } catch { storageWorking = false; return token; }
  };
  const forget = () => { try { if (storage) storage.removeItem(TOKEN_KEY); } catch { storageWorking = false; } };
  const remember = value => {
    try { if (!storage) throw new Error('Storage unavailable'); storage.setItem(TOKEN_KEY, value); storageWorking = true; }
    catch { storageWorking = false; forget(); }
  };
  const logout = (message = '') => {
    advance(); token = null; forget(); publish('anonymous', null, message);
  };
  async function refreshSession() {
    const attempt = advance(); token = read();
    if (!token) { publish('anonymous'); return null; }
    publish('initializing');
    const controller = new AbortController(); pending = controller;
    try {
      const response = await api.get('/api/auth/profile', { signal: controller.signal });
      if (!current(attempt)) return null;
      const account = accountFrom(response.data); publish('authenticated', account); return account;
    } catch (error) {
      if (!current(attempt) || controller.signal.aborted) return null;
      if (error.response?.status === 401 || error.response?.data?.code === 'ACCOUNT_ROLE_UNAVAILABLE') {
        logout('Your sign-in is no longer available. Please sign in again.');
      } else publish('unavailable', null, 'We could not confirm your sign-in. Please try again.');
      return null;
    } finally { if (pending === controller) pending = null; }
  }
  async function login(credentials) {
    const attempt = advance();
    const controller = new AbortController(); pending = controller;
    try {
      const response = await api.post('/api/auth/login', credentials, { signal: controller.signal });
      if (!current(attempt)) return null;
      const account = accountFrom(response.data);
      if (typeof response.data.token !== 'string' || !response.data.token) throw new Error('Sign-in could not be verified.');
      token = response.data.token; remember(token);
      publish('authenticated', account, storageWorking ? '' : 'Signed in for this page. You may need to sign in again after a refresh.');
      return account;
    } catch (error) { if (current(attempt)) throw error; return null; }
    finally { if (pending === controller) pending = null; }
  }
  function updateUser(data, expectedRevision) {
    if (!active || expectedRevision !== revision || snapshot.status !== 'authenticated') return false;
    const account = accountFrom(data);
    if (account.id !== snapshot.user.id) return false;
    publish('authenticated', account, snapshot.sessionMessage); return true;
  }
  async function start() {
    if (active) return null;
    active = true;
    requestInterceptor = api.interceptors.request.use(config => {
      const path = config.url || '';
      if (path.startsWith('/api/') && !/^\/api\/auth\/(login|register)\/?(?:\?|$)/.test(path)) {
        config._hmProtected = true; config._hmRevision = revision;
        if (token) { config.headers = config.headers || {}; config.headers.Authorization = 'Bearer ' + token; }
      }
      return config;
    });
    responseInterceptor = api.interceptors.response.use(response => response, error => {
      const config = error.config;
      if (active && error.response?.status === 401 && config?._hmProtected && config._hmRevision === revision) {
        logout('Your sign-in has expired. Please sign in again.');
      }
      return Promise.reject(error);
    });
    return refreshSession();
  }
  function stop() {
    active = false; advance();
    api.interceptors.request.eject(requestInterceptor); api.interceptors.response.eject(responseInterceptor);
  }
  return { start, stop, login, logout, refreshSession, updateUser, getRevision: () => revision, getSnapshot: () => snapshot };
}
