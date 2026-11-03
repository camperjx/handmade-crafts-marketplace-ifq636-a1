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
