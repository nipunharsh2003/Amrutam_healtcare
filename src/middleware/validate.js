const ApiError = require('../utils/ApiError');

module.exports = (schemas) => (req, res, next) => {
  for (const [key, schema] of Object.entries(schemas)) {
    const result = schema.safeParse(req[key]);
    if (!result.success) {
      return next(new ApiError(400, 'VALIDATION_ERROR', 'Request validation failed'));
    }
    if (key === 'headers') {
      req.validated = { ...req.validated, headers: result.data };
    } else {
      Object.defineProperty(req, key, {
        configurable: true,
        enumerable: true,
        writable: true,
        value: result.data,
      });
    }
  }
  return next();
};