const jwt = require('jsonwebtoken');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { AuditLog, User } = require('../modules/models');

async function auditRejected(actorUserId, requestId) {
  await AuditLog.create({
    actorUserId: actorUserId || null,
    eventType: 'AUTH_TOKEN_REJECTED',
    metadata: { reason: 'invalid_token_or_inactive_account' },
    requestId,
  }).catch(() => {});
}

module.exports = asyncHandler(async (req, res, next) => {
  const [scheme, token] = (req.get('authorization') || '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication is required');
  }

  let claims;
  try {
    claims = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: 'amrutam-api',
      audience: 'amrutam-client',
      complete: false,
    });
    if (typeof claims.sub !== 'string' || !['PATIENT', 'DOCTOR', 'ADMIN'].includes(claims.role)) {
      throw new Error('Invalid token claims');
    }
  } catch (error) {
    await auditRejected(null, req.id);
    throw new ApiError(401, 'INVALID_TOKEN', 'Authentication is required');
  }

  const user = await User.findByPk(claims.sub, { attributes: ['id', 'role', 'isActive', 'mfaEnabled'] });
  if (!user || !user.isActive || user.role !== claims.role || (claims.mfa === true && !user.mfaEnabled)) {
    await auditRejected(user?.id, req.id);
    throw new ApiError(401, 'INVALID_TOKEN', 'Authentication is required');
  }
  req.auth = { userId: user.id, role: user.role, mfa: claims.mfa === true };
  return next();
});