const asyncHandler = require('../../utils/asyncHandler');
const service = require('./analytics.service');

exports.summary = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.summary(req.query) });
});

exports.auditLogs = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.listAuditLogs(req.query) });
});

exports.changeRole = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { user: await service.changeRole(req.auth, req.params.userId, req.body.role) } });
});

exports.verifyDoctor = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: { doctor: await service.verifyDoctor(req.auth, req.params.doctorId, req.body.verificationStatus) },
  });
});