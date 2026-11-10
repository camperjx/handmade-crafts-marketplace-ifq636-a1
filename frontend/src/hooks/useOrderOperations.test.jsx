import { act } from 'react';
import { createRoot } from 'react-dom/client';
import useOrderResource from './useOrderResource';
import useOrderMutation from './useOrderMutation';
import OrderSession from '../components/orders/OrderSession';

let mockRevision = 1;
const mockAuth = { status: 'authenticated', user: { id: 'seller-a' }, getRevision: () => mockRevision };
jest.mock('../context/AuthContext', () => ({ useAuth: () => mockAuth }));
global.IS_REACT_ACT_ENVIRONMENT = true;
const deferred = () => { let resolve; let reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
let container, root, resource, mutation;
function Reader({ loader }) { resource = useOrderResource(loader); return <p>{JSON.stringify(resource.data)}</p>; }
function Writer() { mutation = useOrderMutation(); return <p>{String(mutation.pending)}</p>; }
beforeEach(() => {
  mockRevision = 1; mockAuth.user = { id: 'seller-a' };
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

test('read failures remain errors, and an explicit retry reads fresh data', async () => {
  const loader = jest.fn().mockRejectedValueOnce({ response: { status: 503, data: {} } }).mockResolvedValueOnce([{ id: 'saved' }]);
  await act(async () => root.render(<Reader loader={loader} />));
  expect(resource.error.status).toBe(503); expect(resource.data).toBeNull();
  await act(async () => resource.reload());
  expect(resource.error).toBeNull(); expect(resource.data).toEqual([{ id: 'saved' }]);
});
test('an old request cannot replace a more recent response even if it ignores abort', async () => {
  const old = deferred(); const latest = deferred();
  const loader = jest.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise);
  await act(async () => root.render(<Reader loader={loader} />));
  act(() => { resource.reload(); });
  await act(async () => latest.resolve(['latest']));
  await act(async () => old.resolve(['stale']));
  expect(resource.data).toEqual(['latest']);
  expect(loader.mock.calls[0][0].signal.aborted).toBe(true);
});
test('a changed session remounts data and discards the previous seller response', async () => {
  const old = deferred(); const loader = jest.fn().mockReturnValueOnce(old.promise).mockResolvedValueOnce(['seller-b']);
  await act(async () => root.render(<OrderSession><Reader loader={loader} /></OrderSession>));
  mockRevision += 1; mockAuth.user = { id: 'seller-b' };
  await act(async () => root.render(<OrderSession><Reader loader={loader} /></OrderSession>));
  await act(async () => old.resolve(['seller-a-private']));
  expect(resource.data).toEqual(['seller-b']);
});
test('a synchronous mutation lock prevents duplicate submits and only reports the confirmed result', async () => {
  const request = deferred(); const operation = jest.fn(() => request.promise); let first, second;
  await act(async () => root.render(<Writer />));
  act(() => { first = mutation.run(operation); second = mutation.run(operation); });
  expect(operation).toHaveBeenCalledTimes(1); expect(mutation.pending).toBe(true);
  await expect(second).resolves.toEqual({ ok: false });
  await act(async () => request.resolve({ id: 'saved' }));
  await expect(first).resolves.toEqual({ ok: true, value: { id: 'saved' } });
  expect(mutation.pending).toBe(false);
});
test('a signed-out request cannot report success in the later session', async () => {
  const request = deferred(); let result;
  await act(async () => root.render(<Writer />));
  act(() => { result = mutation.run(() => request.promise); });
  mockRevision += 1;
  await act(async () => request.resolve({ id: 'old-account' }));
  await expect(result).resolves.toEqual({ ok: false });
});
test('a missing write response is explicitly uncertain rather than a confirmed failure', async () => {
  await act(async () => root.render(<Writer />));
  await act(async () => mutation.run(() => Promise.reject(new Error('connection lost'))));
  expect(mutation.error.uncertain).toBe(true);
  expect(mutation.error.message).toContain('Check your saved requests');
  expect(mutation.pending).toBe(false);
});
test.each([500, 502, 503])('a write HTTP %s response also requires reconciliation before resubmission', async status => {
  await act(async () => root.render(<Writer />));
  await act(async () => mutation.run(() => Promise.reject({ response: { status, data: { code: 'SERVER_ERROR', message: 'Please try again.' } } })));
  expect(mutation.error.uncertain).toBe(true);
  expect(mutation.error.message).toBe('We could not confirm the result. Check your saved requests before submitting again.');
  expect(mutation.pending).toBe(false);
});
test('a rejected validation write retains its field errors and is not an uncertain outcome', async () => {
  await act(async () => root.render(<Writer />));
  await act(async () => mutation.run(() => Promise.reject({ response: { status: 400, data: { message: 'Check the price.', errors: { priceCents: 'Invalid price.' } } } })));
  expect(mutation.error.uncertain).toBe(false);
  expect(mutation.error.fields.priceCents).toBe('Invalid price.');
});
