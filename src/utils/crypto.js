const crypto = require('node:crypto');
const env = require('../config/env');

const key = Buffer.from(env.APP_ENCRYPTION_KEY, 'hex');

function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('hex'),
    tag: cipher.getAuthTag().toString('hex'),
  };
}

function decrypt({ ciphertext, iv, tag }) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

module.exports = { encrypt, decrypt };