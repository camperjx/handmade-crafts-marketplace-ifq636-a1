import { centsToAudString, parseAudToCents } from './productMoney';

export const productFormValues = product => ({
  title: product?.title || '',
  description: product?.description || '',
  category: product?.category || '',
  priceAud: product ? centsToAudString(product.priceCents) : '',
});

export function validateProductForm(values) {
  const fields = {};
  const payload = {};
  for (const [field, limit] of [['title', 120], ['description', 2000], ['category', 60]]) {
    payload[field] = values[field].trim();
    if (!payload[field]) fields[field] = `Enter a ${field}.`;
    else if (payload[field].length > limit) fields[field] = `Use at most ${limit} characters.`;
  }
  try { payload.priceCents = parseAudToCents(values.priceAud); }
  catch (error) { fields.priceCents = error.message; }
  return { fields, payload, valid: Object.keys(fields).length === 0 };
}

export function productFailure(error, fallback) {
  return {
    status: error.response?.status || 0,
    code: error.response?.data?.code || '',
    message: error.response?.data?.message || fallback,
    fields: error.response?.data?.errors || {},
    uncertain: !error.response,
    latestProduct: error.latestProduct || null,
  };
}
