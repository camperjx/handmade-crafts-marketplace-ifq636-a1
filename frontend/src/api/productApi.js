import api from '../axiosConfig';

export async function listProducts(options = {}) {
  const response = await api.get('/api/products', options);
  return response.data.products;
}

export async function listMyProducts(options = {}) {
  const response = await api.get('/api/products/mine', options);
  return response.data.products;
}

export async function getProduct(id, options = {}) {
  const response = await api.get(`/api/products/${encodeURIComponent(id)}`, options);
  return response.data.product;
}

export async function createProduct({ title, description, category, priceCents }, options = {}) {
  const response = await api.post('/api/products', { title, description, category, priceCents }, options);
  return response.data.product;
}

export async function updateProduct(id, { title, description, category, priceCents, status }, options = {}) {
  const values = { title, description, category, priceCents, status };
  const changes = Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined));
  const response = await api.patch(`/api/products/${encodeURIComponent(id)}`, changes, options);
  return response.data.product;
}

export const archiveProduct = (id, options) => updateProduct(id, { status: 'archived' }, options);
