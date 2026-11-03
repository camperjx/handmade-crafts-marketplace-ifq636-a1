const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { ROLES } = require('../utils/authValidation');
async function protect(req, res, next) {
  const header = req.headers.authorization;
  const match = typeof header === 'string' && /^Bearer\s+(\S+)$/i.exec(header.trim());
  const unauthorized = () => res.status(401).json({ code: 'UNAUTHENTICATED', message: 'Please sign in again.' });
  if (!match) return unauthorized();
  if (!process.env.JWT_SECRET) return res.status(500).json({ code: 'SERVER_ERROR', message: 'Sign-in verification is unavailable.' });
  let decoded;
  try { decoded = jwt.verify(match[1], process.env.JWT_SECRET, { algorithms: ['HS256'] }); }
  catch (error) { return unauthorized(); }
  if (!decoded || typeof decoded !== 'object' || typeof decoded.id !== 'string' || !/^[a-f\d]{24}$/i.test(decoded.id)) return unauthorized();
  try {
    const user = await User.findById(decoded.id).select('-password').lean();
    if (!user) return unauthorized();
    if (!ROLES.includes(user.role)) return res.status(403).json({ code: 'ACCOUNT_ROLE_UNAVAILABLE', message: 'Account access is unavailable. Please sign in with an available account.' });
    req.user = user;
    return next();
  } catch (error) {
    return res.status(500).json({ code: 'SERVER_ERROR', message: 'Sign-in verification is unavailable. Please try again.' });
  }
}
module.exports = { protect };
