export const roleHome = role => role === 'seller' ? '/seller/products' : '/products';
export function postLoginPath(role, requested) {
  const allowed = ['/products', '/profile'];
  if (role === 'seller') allowed.push('/seller/products');
  return allowed.includes(requested) ? requested : roleHome(role);
}
