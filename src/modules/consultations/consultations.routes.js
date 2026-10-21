const express = require('express');
const controller = require('./consultations.controller');
const validation = require('./consultations.validation');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const validate = require('../../middleware/validate');
const requireMfa = require('../../middleware/requireMfa');
const router = express.Router();

router.use(authenticate);
router.post('/', authorize('PATIENT'), validate({ body: validation.book.shape.body, headers: validation.book.shape.headers }), controller.book);
router.get('/', authorize('PATIENT', 'DOCTOR', 'ADMIN'), requireMfa, validate({ query: validation.list.shape.query }), controller.list);
router.get('/:consultationId', authorize('PATIENT', 'DOCTOR', 'ADMIN'), requireMfa, validate({ params: validation.id.shape.params }), controller.get);
router.post('/:consultationId/cancel', authorize('PATIENT'), validate({ params: validation.id.shape.params }), controller.cancel);
router.post('/:consultationId/start', authorize('DOCTOR'), requireMfa, validate({ params: validation.id.shape.params }), controller.start);
router.post('/:consultationId/complete', authorize('DOCTOR'), requireMfa, validate({ params: validation.id.shape.params }), controller.complete);

module.exports = router;