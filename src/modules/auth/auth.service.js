const crypto = require('node:crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const { UniqueConstraintError } = require('sequelize');
const env = require('../../config/env');
const ApiError = require('../../utils/ApiError');
const { encrypt, decrypt } = require('../../utils/crypto');
const sequelize = require('../../config/database');
const { User, Profile, AuditLog } = require('../models');
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('amrutam-invalid-login-timing', 12);

function issueToken(user, mfa = false) {
  return jwt.sign({ role: user.role, mfa }, env.JWT_SECRET, {
    algorithm: 'HS256',
    subject: user.id,
    issuer: 'amrutam-api',
    audience: 'amrutam-client',
    expiresIn: '15m',
  });
}

async function recordAuthEvent(eventType, actorUserId, metadata) {
  await AuditLog.create({
    actorUserId: actorUserId || null,
    eventType,
    metadata,
  }).catch(() => {});
}

async function register(input) {
  const passwordHash = await bcrypt.hash(input.password, 12);
  const transaction = await sequelize.transaction();
  try {
    const user = await User.create({
      email: input.email,
      passwordHash,
      role: 'PATIENT',
    }, { transaction });
    const profile = await Profile.create({
      userId: user.id,
      firstName: input.firstName,
      lastName: input.lastName,
    }, { transaction });
    await AuditLog.create({
      actorUserId: user.id,
      eventType: 'USER_REGISTERED',
      targetType: 'USER',
      targetId: user.id,
      metadata: { role: 'PATIENT' },
    }, { transaction });
    await transaction.commit();
    return { user, profile };
  } catch (error) {
    await transaction.rollback();
    if (error instanceof UniqueConstraintError) {
      throw new ApiError(409, 'EMAIL_ALREADY_REGISTERED', 'An account with this email already exists');
    }
    throw error;
  }
}

async function login({ email, password, mfaCode }) {
  const user = await User.findOne({ where: { email } });
  const passwordMatches = await bcrypt.compare(password, user?.passwordHash || DUMMY_PASSWORD_HASH);
  if (!user || !passwordMatches || !user.isActive) {
    const identifierHash = crypto.createHash('sha256').update(email).digest('hex');
    await recordAuthEvent('LOGIN_FAILED', null, { identifierHash, reason: 'invalid_credentials' });
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
  }

  if (user.mfaEnabled) {
    if (!mfaCode || !user.mfaSecretCiphertext) {
      await recordAuthEvent('LOGIN_FAILED', user.id, { reason: 'mfa_required' });
      throw new ApiError(401, 'MFA_REQUIRED', 'A valid authenticator code is required');
    }
    const secret = decrypt({
      ciphertext: user.mfaSecretCiphertext,
      iv: user.mfaSecretIv,
      tag: user.mfaSecretTag,
    });
    if (!speakeasy.totp.verify({ secret, encoding: 'base32', token: mfaCode, window: 1 })) {
      await recordAuthEvent('LOGIN_FAILED', user.id, { reason: 'invalid_mfa' });
      throw new ApiError(401, 'INVALID_MFA_CODE', 'Authenticator code is incorrect');
    }
  }

  await recordAuthEvent('LOGIN_SUCCEEDED', user.id, { role: user.role });
  return { user, accessToken: issueToken(user, user.mfaEnabled) };
}

async function setupMfa(userId, password) {
  const user = await User.findByPk(userId);
  if (!user || !await bcrypt.compare(password, user.passwordHash)) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Password is incorrect');
  }
  if (user.mfaEnabled) throw new ApiError(409, 'MFA_ALREADY_ENABLED', 'MFA is already enabled');

  const secret = speakeasy.generateSecret({ name: `Amrutam (${user.email})`, length: 20 });
  const encrypted = encrypt(secret.base32);
  await sequelize.transaction(async (transaction) => {
    await user.update({
      mfaSecretCiphertext: encrypted.ciphertext,
      mfaSecretIv: encrypted.iv,
      mfaSecretTag: encrypted.tag,
    }, { transaction });
    await AuditLog.create({
      actorUserId: user.id,
      eventType: 'MFA_SETUP_STARTED',
      metadata: {},
    }, { transaction });
  });
  return { secret: secret.base32, otpauthUrl: secret.otpauth_url };
}

async function verifyMfa(userId, code) {
  const user = await User.findByPk(userId);
  if (!user?.mfaSecretCiphertext) throw new ApiError(409, 'MFA_SETUP_REQUIRED', 'Start MFA setup first');
  const secret = decrypt({
    ciphertext: user.mfaSecretCiphertext,
    iv: user.mfaSecretIv,
    tag: user.mfaSecretTag,
  });
  if (!speakeasy.totp.verify({ secret, encoding: 'base32', token: code, window: 1 })) {
    throw new ApiError(400, 'INVALID_MFA_CODE', 'Authenticator code is incorrect');
  }
  await sequelize.transaction(async (transaction) => {
    await user.update({ mfaEnabled: true }, { transaction });
    await AuditLog.create({
      actorUserId: user.id,
      eventType: 'MFA_ENABLED',
      metadata: {},
    }, { transaction });
  });
  return { user, accessToken: issueToken(user, true) };
}

module.exports = { register, login, setupMfa, verifyMfa };