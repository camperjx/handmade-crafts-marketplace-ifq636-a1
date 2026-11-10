import { postLoginPath, roleHome } from './utils/roleHome';
test('routes the two account roles to their own home', () => {
  expect(roleHome('buyer')).toBe('/products');
  expect(roleHome('seller')).toBe('/seller/products');
  expect(roleHome('admin')).toBe('/products');
});
test('only restores an internal return path that the account may access', () => {
  expect(postLoginPath('buyer', '/profile')).toBe('/profile');
  expect(postLoginPath('buyer', '/seller/products')).toBe('/products');
  expect(postLoginPath('seller', '/seller/products')).toBe('/seller/products');
  expect(postLoginPath('seller', 'https://example.com')).toBe('/seller/products');
});
test('restores valid Product deep links while rejecting path and role escapes', () => {
  const id = '0123456789abcdef01234567';
  expect(postLoginPath('seller', '/seller/products/new')).toBe('/seller/products/new');
  expect(postLoginPath('seller', `/seller/products/${id}/edit`)).toBe(`/seller/products/${id}/edit`);
  expect(postLoginPath('buyer', `/products/${id}`)).toBe(`/products/${id}`);
  expect(postLoginPath('buyer', `/seller/products/${id}/edit`)).toBe('/products');
  for (const path of [undefined, {}, '//example.com', '/seller/products/../profile', '/seller/products/new/extra', '/products/not-an-id', `/products/${id}?next=https://example.com`]) {
    expect(postLoginPath('seller', path)).toBe('/seller/products');
  }
});
test('restores role-appropriate request routes and normalises a single trailing slash', () => {
  const id='0123456789abcdef01234567';
  expect(postLoginPath('buyer','/orders/')).toBe('/orders');
  expect(postLoginPath('seller','/seller/orders')).toBe('/seller/orders');
  for(const role of ['buyer','seller']) expect(postLoginPath(role,`/orders/${id}`)).toBe(`/orders/${id}`);
  expect(postLoginPath('buyer',`/products/${id}/request`)).toBe(`/products/${id}/request`);
  expect(postLoginPath('seller',`/products/${id}/request`)).toBe('/seller/products');
  expect(postLoginPath('buyer','/seller/orders')).toBe('/products');
  expect(postLoginPath('seller','/orders')).toBe('/seller/products');
  expect(postLoginPath('buyer','/orders/bad')).toBe('/products');
});
