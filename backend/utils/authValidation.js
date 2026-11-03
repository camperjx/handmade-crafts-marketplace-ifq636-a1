const ROLES = ['buyer', 'seller'];
const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function bodyErrors(body, allowed) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { _form: 'Send a JSON object.' };
  if (Object.keys(body).some(key => !allowed.includes(key))) return { _form: 'This request includes unsupported fields.' };
  return {};
}
function readName(value, errors) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 80) {
    errors.name = 'Enter a name between 1 and 80 characters.'; return '';
  }
  return value.trim();
}
function readEmail(value, errors) {
  if (typeof value !== 'string' || value.trim().length > 254 || !emailPattern.test(value.trim())) {
    errors.email = 'Enter a valid email address, up to 254 characters.'; return '';
  }
  return value.trim().toLowerCase();
}
function readPassword(value, errors, registering) {
  if (typeof value !== 'string' || !value || Buffer.byteLength(value, 'utf8') > 72 || (registering && Array.from(value).length < 8)) {
    errors.password = registering ? 'Use at least 8 characters and no more than 72 UTF-8 bytes.' : 'Enter your password, up to 72 UTF-8 bytes.';
    return '';
  }
  return value;
}
const result = (values, errors) => ({ ok: Object.keys(errors).length === 0, values, errors });
function validateRegister(body) {
  const errors = bodyErrors(body, ['name', 'email', 'password', 'role']);
  if (Object.keys(errors).length) return result({}, errors);
  const values = { name: readName(body.name, errors), email: readEmail(body.email, errors), password: readPassword(body.password, errors, true), role: has(body, 'role') ? body.role : 'buyer' };
  if (!ROLES.includes(values.role)) errors.role = 'Choose Buyer or Seller.';
  return result(values, errors);
}
function validateLogin(body) {
  const errors = bodyErrors(body, ['email', 'password']);
  if (Object.keys(errors).length) return result({}, errors);
  return result({ email: readEmail(body.email, errors), password: readPassword(body.password, errors, false) }, errors);
}
function validateProfileUpdate(body) {
  const errors = bodyErrors(body, ['name', 'email', 'address']);
  if (body && typeof body === 'object' && has(body, 'role')) errors.role = 'Your account role cannot be changed.';
  if (Object.keys(errors).length) return result({}, errors);
  if (!Object.keys(body).length) return result({}, { _form: 'Choose a profile field to update.' });
  const values = {};
  if (has(body, 'name')) values.name = readName(body.name, errors);
  if (has(body, 'email')) values.email = readEmail(body.email, errors);
  if (has(body, 'address')) {
    if (typeof body.address !== 'string' || body.address.trim().length > 300) errors.address = 'Enter an address up to 300 characters.';
    else values.address = body.address.trim();
  }
  return result(values, errors);
}
module.exports = { ROLES, validateRegister, validateLogin, validateProfileUpdate };
