const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { ROLES, validateRegister, validateLogin, validateProfileUpdate } = require('../utils/authValidation');
const { toUserDto } = require('../utils/userDto');

const invalid = (res, errors) => res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Please check the highlighted fields.', errors });
const unavailable = res => res.status(401).json({ code: 'ACCOUNT_UNAVAILABLE', message: 'Please sign in again.' });
function writeError(res, error) {
  if (error.code === 11000) return res.status(409).json({ code: 'EMAIL_IN_USE', message: 'This email is already registered.', errors: { email: 'This email is already registered.' } });
  if (error.name === 'ValidationError') return invalid(res, { _form: 'Please check your profile details.' });
  return res.status(500).json({ code: 'SERVER_ERROR', message: 'We could not complete this request. Please try again.' });
}
async function registerUser(req, res) {
  const checked = validateRegister(req.body);
  if (!checked.ok) return invalid(res, checked.errors);
  try {
    if (await User.findOne({ email: checked.values.email }).lean()) return writeError(res, { code: 11000 });
    const user = await User.create(checked.values);
    return res.status(201).json(toUserDto(user));
  } catch (error) { return writeError(res, error); }
}
async function loginUser(req, res) {
  const checked = validateLogin(req.body);
  if (!checked.ok) return invalid(res, checked.errors);
  if (!process.env.JWT_SECRET) return writeError(res, {});
  try {
    // Read persisted roles: schema defaults are not a legacy-data migration.
    const user = await User.findOne({ email: checked.values.email }).lean();
    if (!user || typeof user.password !== 'string' || !(await bcrypt.compare(checked.values.password, user.password))) {
      return res.status(401).json({ code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' });
    }
    if (!ROLES.includes(user.role)) return res.status(403).json({ code: 'ACCOUNT_ROLE_UNAVAILABLE', message: 'Account access is unavailable. Please sign in with an available account.' });
    const token = jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '30d' });
    return res.json({ ...toUserDto(user), token });
  } catch (error) { return writeError(res, error); }
}
function getProfile(req, res) { return res.json(toUserDto(req.user)); }
async function updateUserProfile(req, res) {
  const checked = validateProfileUpdate(req.body);
  if (!checked.ok) return invalid(res, checked.errors);
  try {
    const user = await User.findOneAndUpdate(
      { _id: req.user._id, role: { $in: ROLES } }, { $set: checked.values }, { new: true, runValidators: true }
    ).select('-password').lean();
    if (!user) return unavailable(res);
    return res.json(toUserDto(user));
  } catch (error) { return writeError(res, error); }
}
module.exports = { registerUser, loginUser, getProfile, updateUserProfile };
