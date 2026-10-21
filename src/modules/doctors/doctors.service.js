const { Op, Transaction } = require('sequelize');
const sequelize = require('../../config/database');
const ApiError = require('../../utils/ApiError');
const { User, Profile, Doctor, AuditLog } = require('../models');

async function search({ page, pageSize, name, specialization }) {
  const where = { verificationStatus: 'VERIFIED' };
  if (specialization) where.specialization = { [Op.like]: `%${specialization}%` };
  const profileWhere = name
    ? { [Op.or]: [{ firstName: { [Op.like]: `%${name}%` } }, { lastName: { [Op.like]: `%${name}%` } }] }
    : undefined;
  const result = await Doctor.findAndCountAll({
    where,
    attributes: ['id', 'specialization', 'bio', 'verificationStatus'],
    include: [{ model: User, as: 'user', attributes: ['id'], where: { role: 'DOCTOR', isActive: true }, include: [{
      model: Profile,
      as: 'profile',
      attributes: ['firstName', 'lastName'],
      ...(profileWhere ? { where: profileWhere, required: true } : { required: false }),
    }] }],
    order: [['specialization', 'ASC'], ['id', 'ASC']],
    limit: pageSize,
    offset: (page - 1) * pageSize,
    distinct: true,
  });
  return { items: result.rows, total: result.count, page, pageSize };
}

async function upsertProfile(userId, role, data) {
  const user = role === 'ADMIN' && data.userId
    ? await User.findByPk(data.userId)
    : await User.findByPk(userId);
  if (!user || (role !== 'ADMIN' && user.role !== 'DOCTOR') || (role === 'ADMIN' && user.role !== 'DOCTOR')) {
    throw new ApiError(404, 'DOCTOR_ACCOUNT_NOT_FOUND', 'Doctor account was not found');
  }
  return sequelize.transaction(async (transaction) => {
    const [doctor, created] = await Doctor.findOrCreate({
      where: { userId: user.id },
      defaults: { userId: user.id, ...data, verificationStatus: 'PENDING' },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!created && doctor.licenseNumber !== data.licenseNumber && await Doctor.findOne({
      where: { licenseNumber: data.licenseNumber },
      transaction,
    })) {
      throw new ApiError(409, 'LICENSE_ALREADY_REGISTERED', 'This license is already registered');
    }
    const licenseChanged = !created && doctor.licenseNumber !== data.licenseNumber;
    if (!created) {
      await doctor.update({ ...data, ...(licenseChanged ? { verificationStatus: 'PENDING' } : {}) }, { transaction });
    }
    await AuditLog.create({
      actorUserId: userId,
      eventType: created ? 'DOCTOR_PROFILE_CREATED' : 'DOCTOR_PROFILE_UPDATED',
      targetType: 'DOCTOR',
      targetId: doctor.id,
      metadata: { changedFields: Object.keys(data).filter((field) => field !== 'licenseNumber') },
    }, { transaction });
    return doctor;
  });
}

module.exports = { search, upsertProfile };