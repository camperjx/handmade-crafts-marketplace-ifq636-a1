import api from '../axiosConfig';
import { archiveProduct, createProduct, getProduct, listMyProducts, listProducts, updateProduct } from './productApi';

jest.mock('../axiosConfig', () => ({ get: jest.fn(), post: jest.fn(), patch: jest.fn() }));
beforeEach(() => jest.clearAllMocks());
test('unwraps lists and a single product with relative API paths and cancellation', async () => {
  const signal = new AbortController().signal;
  api.get.mockResolvedValueOnce({ data: { products: [{ id: 'a' }] } });
  expect(await listProducts({ signal })).toEqual([{ id: 'a' }]);
  expect(api.get).toHaveBeenLastCalledWith('/api/products', { signal });
  api.get.mockResolvedValueOnce({ data: { products: [] } });
  expect(await listMyProducts()).toEqual([]);
  expect(api.get).toHaveBeenLastCalledWith('/api/products/mine', {});
  api.get.mockResolvedValueOnce({ data: { product: { id: 'a' } } });
  expect(await getProduct('a')).toEqual({ id: 'a' });
  expect(api.get).toHaveBeenLastCalledWith('/api/products/a', {});
});
test('never turns a read error into an empty success', async () => {
  const failure = new Error('unavailable'); api.get.mockRejectedValueOnce(failure);
  await expect(listProducts()).rejects.toBe(failure);
});
test('whitelists create/update fields and sends archive as a single state change', async () => {
  const product = { title: 'A', description: 'B', category: 'C', priceCents: 2500 };
  api.post.mockResolvedValue({ data: { product: { id: 'a', ...product } } });
  await createProduct({ ...product, sellerId: 'forged', status: 'active' });
  expect(api.post).toHaveBeenCalledWith('/api/products', product, {});
  api.patch.mockResolvedValue({ data: { product: { id: 'a' } } });
  await updateProduct('a', { priceCents: 3000, sellerId: 'forged' });
  expect(api.patch).toHaveBeenLastCalledWith('/api/products/a', { priceCents: 3000 }, {});
  await archiveProduct('a');
  expect(api.patch).toHaveBeenLastCalledWith('/api/products/a', { status: 'archived' }, {});
});
