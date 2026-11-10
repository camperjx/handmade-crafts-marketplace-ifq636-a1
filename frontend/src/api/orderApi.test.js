import api from '../axiosConfig';
import { createOrder, getOrder, listMyOrders, listSellerOrders, updateOrderStatus } from './orderApi';
jest.mock('../axiosConfig', () => ({ get: jest.fn(), post: jest.fn(), patch: jest.fn() }));
beforeEach(() => jest.clearAllMocks());
test('reads related lists/details without silently swallowing failures', async () => {
  api.get.mockResolvedValueOnce({data:{orders:[]}}).mockResolvedValueOnce({data:{orders:[{id:'a'}]}}).mockResolvedValueOnce({data:{order:{id:'a'}}});
  expect(await listMyOrders()).toEqual([]);expect(await listSellerOrders()).toEqual([{id:'a'}]);expect(await getOrder('a')).toEqual({id:'a'});
  expect(api.get.mock.calls.map(call=>call[0])).toEqual(['/api/orders/mine','/api/orders/seller','/api/orders/a']);
  const failure=new Error('read unavailable');api.get.mockRejectedValueOnce(failure);await expect(listMyOrders()).rejects.toBe(failure);
});
test('only submits permitted fields and preserves cancellation options', async () => {
  const signal=new AbortController().signal;api.post.mockResolvedValue({data:{order:{id:'a'}}});api.patch.mockResolvedValue({data:{order:{id:'a',status:'accepted'}}});
  await createOrder({productId:'p',quantity:2,totalCents:1,buyerId:'forged'},{signal});
  expect(api.post).toHaveBeenCalledWith('/api/orders',{productId:'p',quantity:2},{signal});
  await updateOrderStatus('a',{status:'accepted',expectedStatus:'pending',sellerId:'forged'},{signal});
  expect(api.patch).toHaveBeenCalledWith('/api/orders/a/status',{status:'accepted',expectedStatus:'pending'},{signal});
});
