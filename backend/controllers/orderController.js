const Order = require('../models/Order');
const Product = require('../models/Product');
const { toOrderDto } = require('../utils/orderDto');
const { validId, positiveMoney, canTransition, validateOrderCreate, validateOrderStatus } = require('../utils/orderValidation');
const invalid = (res, errors) => res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Please check the highlighted fields.', errors });
const missing = res => res.status(404).json({ code: 'ORDER_NOT_FOUND', message: 'This request was not found.' });
const forbidden = res => res.status(403).json({ code: 'FORBIDDEN', message: 'You do not have access to this request.' });
const conflict = res => res.status(409).json({ code: 'ORDER_STATE_CONFLICT', message: 'This request changed or the action is not allowed. Reload the latest request.' });
const owner = (user, order) => user.role === 'seller' && String(user._id) === String(order.sellerId);
const related = (user, order) => owner(user, order) || (user.role === 'buyer' && String(user._id) === String(order.buyerId));
function checkId(req, res) {
  if (validId(req.params.id)) return true;
  res.status(400).json({ code: 'INVALID_ORDER_ID', message: 'Enter a valid request ID.' }); return false;
}
function noQuery(req, res) {
  if (!Object.keys(req.query).length) return true;
  invalid(res, { _form: 'Query filters are not supported for requests.' }); return false;
}
async function createOrder(req, res, next) {
  const checked = validateOrderCreate(req.body);
  if (!checked.ok) return invalid(res, checked.errors);
  try {
    const product = await Product.findById(checked.values.productId).lean();
    if (!product) return res.status(404).json({ code: 'PRODUCT_NOT_FOUND', message: 'This product is not available.' });
    if (product.status !== 'active') return res.status(409).json({ code: 'PRODUCT_STATE_CONFLICT', message: 'This product is archived and cannot receive new requests.' });
    const totalCents = product.priceCents * checked.values.quantity;
    if (!positiveMoney(product.priceCents) || !positiveMoney(totalCents)) return invalid(res, { quantity: 'This quantity produces an unsupported total.' });
    const order = await Order.create({ buyerId: req.user._id, sellerId: product.sellerId, productId: product._id,
      productTitle: product.title, unitPriceCents: product.priceCents, quantity: checked.values.quantity, totalCents, status: 'pending' });
    return res.status(201).json({ order: toOrderDto(order) });
  } catch (error) { return next(error); }
}
function listBy(field) {
  return async (req, res, next) => {
    if (!noQuery(req, res)) return;
    try {
      const orders = await Order.find({ [field]: req.user._id }).sort({ createdAt: -1, _id: -1 }).lean();
      return res.json({ orders: orders.map(toOrderDto) });
    } catch (error) { return next(error); }
  };
}
async function getOrder(req, res, next) {
  if (!checkId(req, res) || !noQuery(req, res)) return;
  try {
    const order = await Order.findById(req.params.id).lean();
    if (!order) return missing(res);
    if (!related(req.user, order)) return forbidden(res);
    return res.json({ order: toOrderDto(order) });
  } catch (error) { return next(error); }
}
async function updateOrderStatus(req, res, next) {
  if (!checkId(req, res)) return;
  try {
    const order = await Order.findById(req.params.id).lean();
    if (!order) return missing(res);
    if (!owner(req.user, order)) return forbidden(res);
    const checked = validateOrderStatus(req.body);
    if (!checked.ok) return invalid(res, checked.errors);
    const { status, expectedStatus } = checked.values;
    if (order.status !== expectedStatus || !canTransition(expectedStatus, status)) return conflict(res);
    const updated = await Order.findOneAndUpdate(
      { _id: req.params.id, sellerId: req.user._id, status: expectedStatus },
      { $set: { status } }, { new: true, runValidators: true }
    ).lean();
    if (updated) return res.json({ order: toOrderDto(updated) });
    const current = await Order.findById(req.params.id).lean();
    if (!current) return missing(res);
    if (!owner(req.user, current)) return forbidden(res);
    return conflict(res);
  } catch (error) { return next(error); }
}
module.exports = { createOrder, listMyOrders: listBy('buyerId'), listSellerOrders: listBy('sellerId'), getOrder, updateOrderStatus };
