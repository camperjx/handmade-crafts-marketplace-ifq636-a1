import api from '../axiosConfig';
export const listMyOrders = async (options = {}) => (await api.get('/api/orders/mine', options)).data.orders;
export const listSellerOrders = async (options = {}) => (await api.get('/api/orders/seller', options)).data.orders;
export const getOrder = async (id, options = {}) => (await api.get(`/api/orders/${encodeURIComponent(id)}`, options)).data.order;
export const createOrder = async ({ productId, quantity }, options = {}) => (await api.post('/api/orders', { productId, quantity }, options)).data.order;
export const updateOrderStatus = async (id, { status, expectedStatus }, options = {}) => (await api.patch(`/api/orders/${encodeURIComponent(id)}/status`, { status, expectedStatus }, options)).data.order;
