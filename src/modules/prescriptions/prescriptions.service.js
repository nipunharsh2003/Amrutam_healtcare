const { Transaction } = require('sequelize');
const sequelize = require('../../config/database');
const ApiError = require('../../utils/ApiError');
const { encrypt, decrypt } = require('../../utils/crypto');
const { Doctor, Consultation, Prescription, AuditLog } = require('../models');

async function create(actor, consultationId, details) {
  const doctor = await Doctor.findOne({ where: { userId: actor.userId }, attributes: ['id'] });
  if (!doctor) throw new ApiError(403, 'FORBIDDEN', 'Doctor profile is required');
  return sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED }, async (transaction) => {
    const consultation = await Consultation.findByPk(consultationId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!consultation || consultation.doctorId !== doctor.id) {
      throw new ApiError(404, 'CONSULTATION_NOT_FOUND', 'Consultation was not found');
    }
    if (consultation.status !== 'COMPLETED') {
      throw new ApiError(409, 'CONSULTATION_NOT_COMPLETED', 'Prescription requires a completed consultation');
    }
    const encrypted = encrypt(JSON.stringify(details));
    const prescription = await Prescription.create({
      consultationId,
      patientId: consultation.patientId,
      doctorId: doctor.id,
      detailsCiphertext: encrypted.ciphertext,
      detailsIv: encrypted.iv,
      detailsTag: encrypted.tag,
      createdBy: actor.userId,
    }, { transaction });
    await AuditLog.create({
      actorUserId: actor.userId,
      eventType: 'PRESCRIPTION_CREATED',
      targetType: 'PRESCRIPTION',
      targetId: prescription.id,
      metadata: { consultationId },
    }, { transaction });
    return { id: prescription.id, consultationId, createdAt: prescription.createdAt, details };
  });
}

async function listForPatient(userId, { page, pageSize }) {
  const result = await Prescription.findAndCountAll({
    where: { patientId: userId },
    attributes: ['id', 'consultationId', 'detailsCiphertext', 'detailsIv', 'detailsTag', 'createdAt'],
    order: [['createdAt', 'DESC']],
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });
  return {
    items: result.rows.map((row) => ({
      id: row.id,
      consultationId: row.consultationId,
      details: JSON.parse(decrypt({ ciphertext: row.detailsCiphertext, iv: row.detailsIv, tag: row.detailsTag })),
      createdAt: row.createdAt,
    })),
    total: result.count,
    page,
    pageSize,
  };
}

module.exports = { create, listForPatient };