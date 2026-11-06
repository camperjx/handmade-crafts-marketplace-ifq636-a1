const { protect } = require('./authMiddleware');

function optionalProtect(req, res, next) {
  if (req.headers.authorization === undefined) return next();
  return protect(req, res, next);
}

module.exports = { optionalProtect };
