export const roleHome = role => role === 'seller' ? '/seller/products' : '/products';
export function postLoginPath(role, requested) {
  if (typeof requested !== 'string') return roleHome(role);
  const allowed = ['/products', '/profile'];
  if (role === 'seller') allowed.push('/seller/products', '/seller/products/new');
  const detail = /^\/products\/[a-f\d]{24}$/i.test(requested);
  const edit = role === 'seller' && /^\/seller\/products\/[a-f\d]{24}\/edit$/i.test(requested);
  return allowed.includes(requested) || detail || edit ? requested : roleHome(role);
}
