const asyncHandler = require('../../utils/asyncHandler');
const service = require('./availability.service');

exports.create = asyncHandler(async (req, res) => {
  const slot = await service.createSlot(req.auth, req.body);
  res.status(201).json({ success: true, data: { slot } });
});