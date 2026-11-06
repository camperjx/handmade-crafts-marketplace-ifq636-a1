const mongoose = require('mongoose');
const { TEXT_LIMITS } = require('../utils/productValidation');

const productSchema = new mongoose.Schema({
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  title: { type: String, required: true, trim: true, maxlength: TEXT_LIMITS.title },
  description: { type: String, required: true, trim: true, maxlength: TEXT_LIMITS.description },
  category: { type: String, required: true, trim: true, maxlength: TEXT_LIMITS.category },
  priceCents: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  status: { type: String, required: true, enum: ['active', 'archived'], default: 'active' },
}, { timestamps: true });

productSchema.index({ status: 1, createdAt: -1 });
productSchema.index({ sellerId: 1, createdAt: -1 });

module.exports = mongoose.model('Product', productSchema);
