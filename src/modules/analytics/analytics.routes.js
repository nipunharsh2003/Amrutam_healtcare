const express = require('express');
const controller = require('./analytics.controller');
const validation = require('./analytics.validation');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const requireMfa = require('../../middleware/requireMfa');
const validate = require('../../middleware/validate');
const router = express.Router();

router.use(authenticate, authorize('ADMIN'), requireMfa);
router.get('/analytics', validate({ query: validation.query.shape.query }), controller.summary);
router.get('/audit-logs', validate({ query: validation.query.shape.query }), controller.auditLogs);
router.patch('/doctors/:doctorId/verification', validate({ params: validation.doctorVerification.shape.params, body: validation.doctorVerification.shape.body }), controller.verifyDoctor);
router.patch('/users/:userId/role', validate({ params: validation.role.shape.params, body: validation.role.shape.body }), controller.changeRole);

module.exports = router;