const express = require('express');
const controller = require('./availability.controller');
const validation = require('./availability.validation');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const requireMfa = require('../../middleware/requireMfa');
const validate = require('../../middleware/validate');

const router = express.Router();
router.post('/', authenticate, authorize('DOCTOR', 'ADMIN'), requireMfa, validate({ body: validation.create.shape.body }), controller.create);
module.exports = router;