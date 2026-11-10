const STATUSES = Object.freeze(['pending', 'accepted', 'rejected', 'completed']);
const QUANTITY_MAX = 100;
const TRANSITIONS = Object.freeze({ pending: ['accepted', 'rejected'], accepted: ['completed'], rejected: [], completed: [] });
const validId = value => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
const positiveMoney = value => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
const canTransition = (from, to) => Boolean(TRANSITIONS[from]?.includes(to));

function validate(body, statusChange) {
  const values = {}, errors = {};
  const result = () => ({ ok: !Object.keys(errors).length, values, errors });
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    errors._form = 'Send a JSON object.'; return result();
  }
  const allowed = statusChange ? ['status', 'expectedStatus'] : ['productId', 'quantity'];
  if (Object.keys(body).some(key => !allowed.includes(key))) {
    errors._form = 'This request includes unsupported fields.'; return result();
  }
  if (statusChange) {
    for (const key of allowed) {
      if (!STATUSES.includes(body[key])) errors[key] = 'Choose a valid request status.';
      else values[key] = body[key];
    }
  } else {
    if (!validId(body.productId)) errors.productId = 'Enter a valid product ID.';
    else values.productId = body.productId;
    if (typeof body.quantity !== 'number' || !Number.isSafeInteger(body.quantity) || body.quantity < 1 || body.quantity > QUANTITY_MAX) {
      errors.quantity = 'Enter a whole quantity from 1 to 100.';
    } else values.quantity = body.quantity;
  }
  return result();
}
module.exports = { STATUSES, QUANTITY_MAX, validId, positiveMoney, canTransition,
  validateOrderCreate: body => validate(body, false), validateOrderStatus: body => validate(body, true) };
