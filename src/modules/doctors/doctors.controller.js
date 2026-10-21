const asyncHandler = require('../../utils/asyncHandler');
const service = require('./doctors.service');
const { Op } = require('sequelize');
const { Doctor, User, Profile, AvailabilitySlot } = require('../models');
const ApiError = require('../../utils/ApiError');

exports.search = asyncHandler(async (req, res) => {
  const result = await service.search(req.query);
  res.json({ success: true, data: result });
});

exports.upsertProfile = asyncHandler(async (req, res) => {
  const doctor = await service.upsertProfile(req.auth.userId, req.auth.role, req.body);
  res.status(200).json({ success: true, data: { doctor } });
});

exports.getSlots = asyncHandler(async (req, res) => {
  const { doctorId } = req.params;
  const { date } = req.query;
  const startOfDay = new Date(`${date}T00:00:00.000Z`);
  const start = new Date(Math.max(startOfDay.getTime(), Date.now()));
  const end = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
  const doctor = await Doctor.findByPk(doctorId, {
    attributes: ['id', 'specialization', 'verificationStatus'],
    include: [{ model: User, as: 'user', attributes: ['id', 'role', 'isActive'], include: [{ model: Profile, as: 'profile', attributes: ['firstName', 'lastName'] }] }],
  });
  if (!doctor || doctor.verificationStatus !== 'VERIFIED' || doctor.user?.role !== 'DOCTOR' || !doctor.user.isActive) {
    throw new ApiError(404, 'DOCTOR_NOT_FOUND', 'Doctor was not found');
  }
  const slots = await AvailabilitySlot.findAll({
    where: { doctorId, status: 'OPEN', startsAt: { [Op.gte]: start, [Op.lt]: end } },
    order: [['startsAt', 'ASC']],
  });
  res.json({
    success: true,
    data: {
      doctor: {
        id: doctor.id,
        specialization: doctor.specialization,
        firstName: doctor.user.profile.firstName,
        lastName: doctor.user.profile.lastName,
      },
      slots,
    },
  });
});