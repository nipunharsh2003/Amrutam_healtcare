const ApiError = require('../utils/ApiError');

module.exports = (req, res, next) => {
  if (req.auth?.role !== 'PATIENT' && req.auth?.mfa !== true) {
    return next(new ApiError(403, 'MFA_REQUIRED', 'Enable and verify MFA to perform this action'));
  }
  return next();
};