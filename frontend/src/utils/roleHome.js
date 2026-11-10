export const roleHome = role => role === 'seller' ? '/seller/products' : '/products';
export function postLoginPath(role, requested) {
  if (typeof requested !== 'string') return roleHome(role);
  requested = requested.replace(/\/$/, '');
  const allowed = ['/products', '/profile'];
  if (role === 'seller') allowed.push('/seller/products', '/seller/products/new', '/seller/orders');
  if (role === 'buyer') allowed.push('/orders');
  const detail = /^\/products\/[a-f\d]{24}$/i.test(requested);
  const edit = role === 'seller' && /^\/seller\/products\/[a-f\d]{24}\/edit$/i.test(requested);
  const order = /^\/orders\/[a-f\d]{24}$/i.test(requested);
  const request = role === 'buyer' && /^\/products\/[a-f\d]{24}\/request$/i.test(requested);
  return allowed.includes(requested) || detail || edit || order || request ? requested : roleHome(role);
}
