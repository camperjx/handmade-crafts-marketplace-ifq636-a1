const Product = require('../models/Product');
const { validateProductCreate, validateProductPatch } = require('../utils/productValidation');
const { toProductDto } = require('../utils/productDto');

const notFound = res => res.status(404).json({ code: 'PRODUCT_NOT_FOUND', message: 'This product is not available.' });
const forbidden = res => res.status(403).json({ code: 'FORBIDDEN', message: 'You do not have access.' });
const conflict = res => res.status(409).json({ code: 'PRODUCT_STATE_CONFLICT', message: 'This product is already archived. Reload the latest details.' });
const invalid = (res, errors) => res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Please check the highlighted fields.', errors });
const isOwner = (user, product) => user?.role === 'seller' && String(user._id) === String(product.sellerId);
function validId(req, res) {
  if (/^[a-f\d]{24}$/i.test(req.params.id)) return true;
  res.status(400).json({ code: 'INVALID_PRODUCT_ID', message: 'Enter a valid product ID.' });
  return false;
}

async function listProducts(req, res, next) {
  try {
    const products = await Product.find({ status: 'active' }).sort({ createdAt: -1, _id: -1 }).lean();
    return res.json({ products: products.map(toProductDto) });
  } catch (error) { return next(error); }
}

async function listMyProducts(req, res, next) {
  try {
    const products = await Product.find({ sellerId: req.user._id }).sort({ createdAt: -1, _id: -1 }).lean();
    return res.json({ products: products.map(toProductDto) });
  } catch (error) { return next(error); }
}

async function getProduct(req, res, next) {
  if (!validId(req, res)) return;
  try {
    const product = await Product.findById(req.params.id).lean();
    if (!product || (product.status !== 'active' && !isOwner(req.user, product))) return notFound(res);
    return res.json({ product: toProductDto(product) });
  } catch (error) { return next(error); }
}

async function createProduct(req, res, next) {
  const checked = validateProductCreate(req.body);
  if (!checked.ok) return invalid(res, checked.errors);
  try {
    const product = await Product.create({ ...checked.values, sellerId: req.user._id, status: 'active' });
    return res.status(201).json({ product: toProductDto(product) });
  } catch (error) { return next(error); }
}

async function updateProduct(req, res, next) {
  if (!validId(req, res)) return;
  try {
    const product = await Product.findById(req.params.id).lean();
    if (!product) return notFound(res);
    if (!isOwner(req.user, product)) return forbidden(res);
    const checked = validateProductPatch(req.body);
    if (!checked.ok) return invalid(res, checked.errors);
    if (product.status !== 'active') return conflict(res);

    const updated = await Product.findOneAndUpdate(
      { _id: req.params.id, sellerId: req.user._id, status: 'active' },
      { $set: checked.values },
      { new: true, runValidators: true }
    ).lean();
    if (updated) return res.json({ product: toProductDto(updated) });

    const current = await Product.findById(req.params.id).lean();
    if (!current) return notFound(res);
    if (!isOwner(req.user, current)) return forbidden(res);
    return conflict(res);
  } catch (error) { return next(error); }
}

module.exports = { listProducts, listMyProducts, getProduct, createProduct, updateProduct };
