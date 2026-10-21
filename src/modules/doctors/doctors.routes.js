const express = require('express');
const controller = require('./doctors.controller');
const validation = require('./doctors.validation');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const requireMfa = require('../../middleware/requireMfa');
const validate = require('../../middleware/validate');
const router = express.Router();

router.get('/', validate({ query: validation.search.shape.query }), controller.search);
router.get('/:doctorId/slots', validate({ params: validation.slots.shape.params, query: validation.slots.shape.query }), controller.getSlots);
router.put('/me/profile', authenticate, authorize('DOCTOR'), requireMfa, validate({ body: validation.profile.shape.body }), controller.upsertProfile);

module.exports = router;