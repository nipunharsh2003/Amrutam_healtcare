const crypto = require('node:crypto');
const { Op, Transaction, UniqueConstraintError } = require('sequelize');
const sequelize = require('../../config/database');
const ApiError = require('../../utils/ApiError');
const {
  User,
  Doctor,
  AvailabilitySlot,
  Consultation,
  IdempotencyKey,
  SlotReservation,
  AuditLog,
  OutboxEvent,
} = require('../models');
const { withTransientRetry } = require('../../utils/withTransientRetry');

const hashPayload = (payload) => crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');

async function bookOnce(patientId, slotId, idempotencyKey) {
  const requestHash = hashPayload({ slotId });
  const transaction = await sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED });
  try {
    const prior = await IdempotencyKey.findOne({
      where: { userId: patientId, key: idempotencyKey },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (prior && prior.expiresAt > new Date()) {
      if (prior.requestHash !== requestHash) {
        throw new ApiError(409, 'IDEMPOTENCY_KEY_REUSED', 'Idempotency key was already used with a different request');
      }
      await transaction.commit();
      return { body: prior.responseBody, replayed: true };
    }
    if (prior) await prior.destroy({ transaction });

    const idempotency = await IdempotencyKey.create({
      userId: patientId,
      key: idempotencyKey,
      requestHash,
      responseBody: null,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    }, { transaction });

    const slot = await AvailabilitySlot.findByPk(slotId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!slot || slot.status !== 'OPEN' || new Date(slot.startsAt) <= new Date()) {
      throw new ApiError(409, 'SLOT_UNAVAILABLE', 'This availability slot is no longer available');
    }
    const doctor = await Doctor.findByPk(slot.doctorId, { transaction });
    const doctorUser = doctor && await User.findByPk(doctor.userId, { transaction });
    if (!doctor || doctor.verificationStatus !== 'VERIFIED' || !doctorUser?.isActive || doctorUser.role !== 'DOCTOR') {
      throw new ApiError(409, 'DOCTOR_UNAVAILABLE', 'This doctor cannot accept bookings');
    }

    const consultation = await Consultation.create({
      slotId: slot.id,
      patientId,
      doctorId: doctor.id,
      status: 'BOOKED',
    }, { transaction });
    await SlotReservation.create({ slotId: slot.id, consultationId: consultation.id }, { transaction });
    await slot.update({ status: 'BOOKED' }, { transaction });
    const responseBody = {
      id: consultation.id,
      slotId: slot.id,
      doctorId: doctor.id,
      status: consultation.status,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
    };
    await idempotency.update({ responseBody }, { transaction });
    await OutboxEvent.create({
      eventType: 'CONSULTATION_BOOKED',
      aggregateType: 'CONSULTATION',
      aggregateId: consultation.id,
      payload: { consultationId: consultation.id, patientId, doctorId: doctor.id, slotId: slot.id },
      availableAt: new Date(),
    }, { transaction });
    await AuditLog.create({
      actorUserId: patientId,
      eventType: 'CONSULTATION_BOOKED',
      targetType: 'CONSULTATION',
      targetId: consultation.id,
      metadata: { doctorId: doctor.id, slotId: slot.id },
    }, { transaction });
    await transaction.commit();
    return { body: responseBody, replayed: false };
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    if (error instanceof UniqueConstraintError) {
      const prior = await IdempotencyKey.findOne({ where: { userId: patientId, key: idempotencyKey } });
      if (prior) {
        if (prior.requestHash !== requestHash) {
          throw new ApiError(409, 'IDEMPOTENCY_KEY_REUSED', 'Idempotency key was already used with a different request');
        }
        if (prior.responseBody) return { body: prior.responseBody, replayed: true };
      }
      throw new ApiError(409, 'SLOT_UNAVAILABLE', 'This availability slot is no longer available');
    }
    throw error;
  }
}

function book(patientId, slotId, idempotencyKey) {
  return withTransientRetry(() => bookOnce(patientId, slotId, idempotencyKey));
}

async function listForActor(actor, { page, pageSize, status }) {
  const where = {};
  if (actor.role === 'PATIENT') where.patientId = actor.userId;
  if (actor.role === 'DOCTOR') {
    const doctor = await Doctor.findOne({ where: { userId: actor.userId }, attributes: ['id'] });
    if (!doctor) return { items: [], total: 0, page, pageSize };
    where.doctorId = doctor.id;
  }
  if (status) where.status = status;
  const result = await Consultation.findAndCountAll({
    where,
    include: [{ model: AvailabilitySlot, as: 'slot', attributes: ['startsAt', 'endsAt'] }],
    order: [['createdAt', 'DESC']],
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });
  return { items: result.rows, total: result.count, page, pageSize };
}

async function getForActor(actor, consultationId) {
  const consultation = await Consultation.findByPk(consultationId, {
    include: [{ model: AvailabilitySlot, as: 'slot', attributes: ['startsAt', 'endsAt'] }],
  });
  if (!consultation) throw new ApiError(404, 'CONSULTATION_NOT_FOUND', 'Consultation was not found');
  if (actor.role === 'PATIENT' && consultation.patientId !== actor.userId) {
    throw new ApiError(404, 'CONSULTATION_NOT_FOUND', 'Consultation was not found');
  }
  if (actor.role === 'DOCTOR') {
    const doctor = await Doctor.findOne({ where: { userId: actor.userId }, attributes: ['id'] });
    if (!doctor || consultation.doctorId !== doctor.id) {
      throw new ApiError(404, 'CONSULTATION_NOT_FOUND', 'Consultation was not found');
    }
  }
  return consultation;
}

async function cancel(actor, consultationId) {
  return sequelize.transaction(async (transaction) => {
    const consultation = await Consultation.findByPk(consultationId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!consultation || consultation.patientId !== actor.userId) {
      throw new ApiError(404, 'CONSULTATION_NOT_FOUND', 'Consultation was not found');
    }
    const slot = await AvailabilitySlot.findByPk(consultation.slotId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (consultation.status !== 'BOOKED' || !slot || new Date(slot.startsAt) <= new Date()) {
      throw new ApiError(409, 'CANCELLATION_NOT_ALLOWED', 'This consultation cannot be cancelled');
    }
    await consultation.update({ status: 'CANCELLED' }, { transaction });
    await SlotReservation.destroy({ where: { slotId: slot.id }, transaction });
    await slot.update({ status: 'OPEN' }, { transaction });
    await AuditLog.create({
      actorUserId: actor.userId,
      eventType: 'CONSULTATION_CANCELLED',
      targetType: 'CONSULTATION',
      targetId: consultation.id,
      metadata: {},
    }, { transaction });
    await OutboxEvent.create({
      eventType: 'CONSULTATION_CANCELLED',
      aggregateType: 'CONSULTATION',
      aggregateId: consultation.id,
      payload: { consultationId: consultation.id, patientId: actor.userId, doctorId: consultation.doctorId, slotId: slot.id },
      availableAt: new Date(),
    }, { transaction });
    return consultation;
  });
}

async function transition(actor, consultationId, nextStatus) {
  const doctor = await Doctor.findOne({ where: { userId: actor.userId }, attributes: ['id'] });
  if (!doctor) throw new ApiError(403, 'FORBIDDEN', 'Doctor profile is required');
  return sequelize.transaction(async (transaction) => {
    const consultation = await Consultation.findByPk(consultationId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!consultation || consultation.doctorId !== doctor.id) {
      throw new ApiError(404, 'CONSULTATION_NOT_FOUND', 'Consultation was not found');
    }
    const expectedStatus = nextStatus === 'IN_PROGRESS' ? 'BOOKED' : 'IN_PROGRESS';
    if (consultation.status !== expectedStatus) {
      throw new ApiError(409, 'INVALID_STATE_TRANSITION', 'Consultation cannot move to the requested state');
    }
    const now = new Date();
    const fields = nextStatus === 'IN_PROGRESS' ? { status: nextStatus, startedAt: now } : { status: 'COMPLETED', completedAt: now };
    await consultation.update(fields, { transaction });
    await AuditLog.create({
      actorUserId: actor.userId,
      eventType: `CONSULTATION_${nextStatus}`,
      targetType: 'CONSULTATION',
      targetId: consultation.id,
      metadata: { status: nextStatus },
    }, { transaction });
    await OutboxEvent.create({
      eventType: `CONSULTATION_${nextStatus}`,
      aggregateType: 'CONSULTATION',
      aggregateId: consultation.id,
      payload: { consultationId: consultation.id, patientId: consultation.patientId, doctorId: doctor.id },
      availableAt: new Date(),
    }, { transaction });
    return consultation;
  });
}

module.exports = { book, listForActor, getForActor, cancel, transition };