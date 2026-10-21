const { Op, Transaction } = require('sequelize');
const sequelize = require('../../config/database');
const ApiError = require('../../utils/ApiError');
const { User, Doctor, AvailabilitySlot, AuditLog } = require('../models');

async function createSlot(actor, data) {
  return sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED }, async (transaction) => {
    const doctor = await Doctor.findByPk(data.doctorId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!doctor || (actor.role !== 'ADMIN' && doctor.userId !== actor.userId)) {
      throw new ApiError(404, 'DOCTOR_NOT_FOUND', 'Doctor was not found');
    }
    if (doctor.verificationStatus !== 'VERIFIED') {
      throw new ApiError(403, 'DOCTOR_NOT_VERIFIED', 'Doctor profile must be verified first');
    }
    const doctorUser = await User.findByPk(doctor.userId, { transaction });
    if (!doctorUser?.isActive || doctorUser.role !== 'DOCTOR') {
      throw new ApiError(403, 'DOCTOR_UNAVAILABLE', 'Doctor account cannot publish availability');
    }
    const overlap = await AvailabilitySlot.findOne({
      where: {
        doctorId: doctor.id,
        status: { [Op.ne]: 'CANCELLED' },
        startsAt: { [Op.lt]: new Date(data.endsAt) },
        endsAt: { [Op.gt]: new Date(data.startsAt) },
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (overlap) throw new ApiError(409, 'SLOT_OVERLAP', 'Availability overlaps an existing slot');
    const slot = await AvailabilitySlot.create({ ...data, status: 'OPEN' }, { transaction });
    await AuditLog.create({
      actorUserId: actor.userId,
      eventType: 'AVAILABILITY_SLOT_CREATED',
      targetType: 'AVAILABILITY_SLOT',
      targetId: slot.id,
      metadata: { doctorId: doctor.id },
    }, { transaction });
    return slot;
  });
}

module.exports = { createSlot };