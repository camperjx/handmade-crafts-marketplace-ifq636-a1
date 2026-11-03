const { ROLES } = require('../utils/authValidation');
function authorize(...allowedRoles) {
  if (!allowedRoles.length || allowedRoles.some(role => !ROLES.includes(role))) throw new Error('Configure authorize with buyer or seller roles.');
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ code: 'UNAUTHENTICATED', message: 'Please sign in.' });
    if (!allowedRoles.includes(req.user.role)) return res.status(403).json({ code: 'FORBIDDEN', message: 'You do not have access.' });
    return next();
  };
}
module.exports = { authorize };
