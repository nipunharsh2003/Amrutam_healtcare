const { UniqueConstraintError, ForeignKeyConstraintError, ValidationError } = require('sequelize');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

module.exports = (error, req, res, next) => {
  if (res.headersSent) return next(error);

  let apiError = error;
  if (error instanceof UniqueConstraintError) {
    apiError = new ApiError(409, 'CONFLICT', 'The requested resource already exists');
  } else if (error instanceof ForeignKeyConstraintError) {
    apiError = new ApiError(409, 'REFERENCE_CONFLICT', 'The requested operation conflicts with related data');
  } else if (error instanceof ValidationError) {
    apiError = new ApiError(400, 'VALIDATION_ERROR', 'Request validation failed');
  } else if (error.type === 'entity.parse.failed') {
    apiError = new ApiError(400, 'INVALID_JSON', 'Request body must contain valid JSON');
  } else if (error.type === 'entity.too.large') {
    apiError = new ApiError(413, 'REQUEST_TOO_LARGE', 'Request body is too large');
  }

  const status = apiError.statusCode || 500;
  if (status >= 500) {
    logger.error({ errorName: error.name, errorCode: error.code, requestId: req.id }, 'Request failed');
  }
  return res.status(status).json({
    success: false,
    error: {
      code: apiError.code || 'INTERNAL_ERROR',
      message: status >= 500 ? 'An unexpected error occurred' : apiError.message,
      requestId: req.id,
    },
  });
};