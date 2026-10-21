const asyncHandler = require('../../utils/asyncHandler');
const service = require('./consultations.service');

exports.book = asyncHandler(async (req, res) => {
  const result = await service.book(req.auth.userId, req.body.slotId, req.validated.headers['idempotency-key']);
  res.status(result.replayed ? 200 : 201).json({ success: true, data: result.body });
});

exports.list = asyncHandler(async (req, res) => {
  const result = await service.listForActor(req.auth, req.query);
  res.json({ success: true, data: result });
});

exports.get = asyncHandler(async (req, res) => {
  const consultation = await service.getForActor(req.auth, req.params.consultationId);
  res.json({ success: true, data: { consultation } });
});

exports.cancel = asyncHandler(async (req, res) => {
  const consultation = await service.cancel(req.auth, req.params.consultationId);
  res.json({ success: true, data: { consultation } });
});

exports.start = asyncHandler(async (req, res) => {
  const consultation = await service.transition(req.auth, req.params.consultationId, 'IN_PROGRESS');
  res.json({ success: true, data: { consultation } });
});

exports.complete = asyncHandler(async (req, res) => {
  const consultation = await service.transition(req.auth, req.params.consultationId, 'COMPLETED');
  res.json({ success: true, data: { consultation } });
});