const mongoose = require('mongoose');
const { STATUSES, QUANTITY_MAX, positiveMoney } = require('../utils/orderValidation');
const reference = ref => ({ type: mongoose.Schema.Types.ObjectId, ref, required: true, immutable: true });
const money = () => ({ type: Number, required: true, immutable: true, validate: positiveMoney });
const orderSchema = new mongoose.Schema({
  buyerId: reference('User'), sellerId: reference('User'), productId: reference('Product'),
  productTitle: { type: String, required: true, trim: true, maxlength: 120, immutable: true },
  unitPriceCents: money(),
  quantity: { type: Number, required: true, min: 1, max: QUANTITY_MAX, validate: Number.isSafeInteger, immutable: true },
  totalCents: money(),
  status: { type: String, required: true, enum: STATUSES, default: 'pending' },
}, { timestamps: true });
orderSchema.pre('validate', function () {
  if (this.totalCents !== this.unitPriceCents * this.quantity) this.invalidate('totalCents', 'The saved total must match the unit price and quantity.');
});
orderSchema.index({ buyerId: 1, createdAt: -1, _id: -1 });
orderSchema.index({ sellerId: 1, createdAt: -1, _id: -1 });
module.exports = mongoose.model('Order', orderSchema);
