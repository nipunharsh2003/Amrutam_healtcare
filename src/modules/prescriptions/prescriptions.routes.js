const express = require('express');
const controller = require('./prescriptions.controller');
const validation = require('./prescriptions.validation');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const validate = require('../../middleware/validate');
const requireMfa = require('../../middleware/requireMfa');
const router = express.Router();

router.use(authenticate);
router.post('/:consultationId', authorize('DOCTOR'), requireMfa, validate({ params: validation.create.shape.params, body: validation.create.shape.body }), controller.create);
router.get('/', authorize('PATIENT'), validate({ query: validation.list.shape.query }), controller.list);

module.exports = router;