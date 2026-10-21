const express = require('express');
const controller = require('./auth.controller');
const validation = require('./auth.validation');
const validate = require('../../middleware/validate');
const authenticate = require('../../middleware/authenticate');
const { authRateLimiter } = require('../../middleware/rateLimiter');

const router = express.Router();

router.post('/register', authRateLimiter, validate({ body: validation.register.shape.body }), controller.register);
router.post('/login', authRateLimiter, validate({ body: validation.login.shape.body }), controller.login);
router.get('/me', authenticate, controller.getProfile);
router.patch('/me', authenticate, validate({ body: validation.updateProfile.shape.body }), controller.updateProfile);
router.post('/mfa/setup', authRateLimiter, authenticate, validate({ body: validation.mfaSetup.shape.body }), controller.setupMfa);
router.post('/mfa/verify', authRateLimiter, authenticate, validate({ body: validation.mfaVerify.shape.body }), controller.verifyMfa);

module.exports = router;