const asyncHandler = require('../../utils/asyncHandler');
const service = require('./prescriptions.service');

exports.create = asyncHandler(async (req, res) => {
  const prescription = await service.create(req.auth, req.params.consultationId, req.body.details);
  res.status(201).json({ success: true, data: { prescription } });
});

exports.list = asyncHandler(async (req, res) => {
  const result = await service.listForPatient(req.auth.userId, req.query);
  res.json({ success: true, data: result });
});