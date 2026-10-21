const { QueryTypes, Transaction } = require('sequelize');
const sequelize = require('../../config/database');
const ApiError = require('../../utils/ApiError');
const { User, Doctor, Consultation, AuditLog } = require('../models');

async function summary({ from, to }) {
  const replacements = { from: from || '1970-01-01 00:00:00', to: to || '9999-12-31 23:59:59' };
  const [usersByRole, consultationsByStatus, consultationsByDate, total] = await Promise.all([
    sequelize.query('SELECT role, COUNT(*) AS total FROM users GROUP BY role', { type: QueryTypes.SELECT }),
    sequelize.query(
      'SELECT status, COUNT(*) AS total FROM consultations WHERE created_at BETWEEN :from AND :to GROUP BY status',
      { replacements, type: QueryTypes.SELECT },
    ),
    sequelize.query(
      'SELECT DATE(created_at) AS date, COUNT(*) AS total FROM consultations WHERE created_at BETWEEN :from AND :to GROUP BY DATE(created_at) ORDER BY date ASC',
      { replacements, type: QueryTypes.SELECT },
    ),
    Consultation.count({ where: { createdAt: { [require('sequelize').Op.between]: [new Date(replacements.from), new Date(replacements.to)] } } }),
  ]);
  return { usersByRole, totalConsultations: total, consultationsByStatus, consultationsByDate };
}

async function listAuditLogs({ page, pageSize, from, to }) {
  const where = {};
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt[require('sequelize').Op.gte] = new Date(from);
    if (to) where.createdAt[require('sequelize').Op.lte] = new Date(to);
  }
  const result = await AuditLog.findAndCountAll({
    where,
    attributes: ['id', 'actorUserId', 'eventType', 'targetType', 'targetId', 'metadata', 'requestId', 'createdAt'],
    order: [['createdAt', 'DESC']],
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });
  return { items: result.rows, total: result.count, page, pageSize };
}

async function changeRole(actor, targetId, role) {
  return sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED }, async (transaction) => {
    const target = await User.findByPk(targetId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!target) throw new ApiError(404, 'USER_NOT_FOUND', 'User was not found');
    if (target.role === 'ADMIN' && role !== 'ADMIN') {
      const admins = await User.findAll({
        where: { role: 'ADMIN', isActive: true },
        attributes: ['id'],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (admins.length <= 1) throw new ApiError(409, 'LAST_ADMIN', 'The final active administrator cannot be demoted');
    }
    const previousRole = target.role;
    await target.update({ role }, { transaction });
    await AuditLog.create({
      actorUserId: actor.userId,
      eventType: 'ADMIN_ROLE_CHANGED',
      targetType: 'USER',
      targetId: target.id,
      metadata: { previousRole, role },
    }, { transaction });
    return { id: target.id, role: target.role };
  });
}

async function verifyDoctor(actor, doctorId, verificationStatus) {
  return sequelize.transaction(async (transaction) => {
    const doctor = await Doctor.findByPk(doctorId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!doctor) throw new ApiError(404, 'DOCTOR_NOT_FOUND', 'Doctor was not found');
    const previousStatus = doctor.verificationStatus;
    await doctor.update({ verificationStatus }, { transaction });
    await AuditLog.create({
      actorUserId: actor.userId,
      eventType: 'ADMIN_DOCTOR_VERIFICATION_CHANGED',
      targetType: 'DOCTOR',
      targetId: doctor.id,
      metadata: { previousStatus, verificationStatus },
    }, { transaction });
    return { id: doctor.id, verificationStatus: doctor.verificationStatus };
  });
}

module.exports = { summary, listAuditLogs, changeRole, verifyDoctor };