const TEXT_LIMITS = Object.freeze({ title: 120, description: 2000, category: 60 });
const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

function validate(body, updating) {
  const values = {};
  const errors = {};
  const result = () => ({ ok: Object.keys(errors).length === 0, values, errors });
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    errors._form = 'Send a JSON object.';
    return result();
  }
  const allowed = [...Object.keys(TEXT_LIMITS), 'priceCents', ...(updating ? ['status'] : [])];
  if (Object.keys(body).some(key => !allowed.includes(key))) {
    errors._form = 'This request includes unsupported fields.';
    return result();
  }
  if (updating && Object.keys(body).length === 0) {
    errors._form = 'Choose a product field to update.';
    return result();
  }
  for (const [field, limit] of Object.entries(TEXT_LIMITS)) {
    if (updating && !has(body, field)) continue;
    const input = body[field];
    if (typeof input !== 'string' || !input.trim() || input.trim().length > limit) {
      errors[field] = 'Enter text between 1 and ' + limit + ' characters.';
    } else values[field] = input.trim();
  }
  if (!updating || has(body, 'priceCents')) {
    if (typeof body.priceCents !== 'number' || !Number.isSafeInteger(body.priceCents) || body.priceCents <= 0) {
      errors.priceCents = 'Enter a positive whole number of cents.';
    } else values.priceCents = body.priceCents;
  }
  if (updating && has(body, 'status')) {
    if (body.status !== 'archived') errors.status = 'A product can only be archived.';
    else values.status = 'archived';
  }
  return result();
}

module.exports = {
  TEXT_LIMITS,
  validateProductCreate: body => validate(body, false),
  validateProductPatch: body => validate(body, true),
};
