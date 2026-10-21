const pino = require('pino');
const env = require('../config/env');

module.exports = pino({
  level: env.LOG_LEVEL,
  serializers: {
    err: (error) => ({ type: error.name, code: error.code }),
  },
  redact: {
    paths: [
      'password',
      'passwordHash',
      'password_hash',
      'authorization',
      'headers.authorization',
      'req.headers.authorization',
      'req.headers.cookie',
      'token',
      'accessToken',
      'mfaSecret',
      'details',
      'detailsCiphertext',
      'details_ciphertext',
    ],
    censor: '[REDACTED]',
  },
});