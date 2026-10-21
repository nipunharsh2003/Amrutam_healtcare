const ApiError = require('../utils/ApiError');

module.exports = (...roles) => (req, res, next) => {
  if (!req.auth || !roles.includes(req.auth.role)) {
    return next(new ApiError(403, 'FORBIDDEN', 'You are not allowed to perform this action'));
  }
  return next();
};