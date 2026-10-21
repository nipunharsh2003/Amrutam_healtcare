const { randomUUID } = require('node:crypto');
const request = require('supertest');
const bcrypt = require('bcrypt');
const sequelize = require('../../src/config/database');
const { User, Profile, Doctor, AvailabilitySlot, Consultation, SlotReservation, IdempotencyKey, AuditLog } = require('../../src/modules/models');
const booking = require('../../src/modules/consultations/consultations.service');
const auth = require('../../src/modules/auth/auth.service');
const prescriptions = require('../../src/modules/prescriptions/prescriptions.service');
const app = require('../../src/app');

const integrationEnabled = process.env.RUN_DB_INTEGRATION === 'true';
const dbDescribe = integrationEnabled ? describe : describe.skip;

dbDescribe('MySQL booking safety', () => {
  let patient;
  let secondPatient;
  let doctorUser;
  let doctor;

  const makeSlot = async () => {
    const startsAt = new Date(Date.now() + 60 * 60 * 1000);
    return AvailabilitySlot.create({
      doctorId: doctor.id,
      startsAt,
      endsAt: new Date(startsAt.getTime() + 30 * 60 * 1000),
      status: 'OPEN',
    });
  };

  beforeAll(async () => {
    if (!process.env.TEST_DB_NAME.endsWith('_test')) {
      throw new Error('Integration tests require a database name ending in _test');
    }
    await sequelize.authenticate();
    const tables = await sequelize.getQueryInterface().showAllTables();
    for (const table of ['users', 'doctors', 'availability_slots', 'consultations', 'slot_reservations', 'idempotency_keys']) {
      if (!tables.includes(table)) throw new Error(`Missing migrated test table: ${table}`);
    }
  });

  beforeEach(async () => {
    await SlotReservation.destroy({ where: {} });
    await IdempotencyKey.destroy({ where: {} });
    await Consultation.destroy({ where: {} });
    await AvailabilitySlot.destroy({ where: {} });
    await Doctor.destroy({ where: {} });
    await AuditLog.destroy({ where: {} });
    await User.destroy({ where: {} });
    patient = await User.create({ email: `${randomUUID()}@patient.test`, passwordHash: await bcrypt.hash('test-password-value', 4), role: 'PATIENT' });
    secondPatient = await User.create({ email: `${randomUUID()}@patient.test`, passwordHash: await bcrypt.hash('test-password-value', 4), role: 'PATIENT' });
    doctorUser = await User.create({ email: `${randomUUID()}@doctor.test`, passwordHash: await bcrypt.hash('test-password-value', 4), role: 'DOCTOR' });
    doctor = await Doctor.create({ userId: doctorUser.id, specialization: 'General Practice', licenseNumber: randomUUID(), verificationStatus: 'VERIFIED' });
  });

  afterAll(async () => sequelize.close());

  test('two simultaneous patients cannot reserve the same slot', async () => {
    const slot = await makeSlot();
    const results = await Promise.allSettled([
      booking.book(patient.id, slot.id, randomUUID()),
      booking.book(secondPatient.id, slot.id, randomUUID()),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(await Consultation.count({ where: { slotId: slot.id } })).toBe(1);
    expect(await SlotReservation.count({ where: { slotId: slot.id } })).toBe(1);
  });

  test('public slot lookup returns verified doctor details without private account fields', async () => {
    await Profile.create({ userId: doctorUser.id, firstName: 'Doctor', lastName: 'Example' });
    const slot = await makeSlot();
    const date = slot.startsAt.toISOString().slice(0, 10);
    const response = await request(app).get(`/api/v1/doctors/${doctor.id}/slots?date=${date}`);

    expect(response.status).toBe(200);
    expect(response.body.data.doctor).toMatchObject({ id: doctor.id, firstName: 'Doctor', lastName: 'Example' });
    expect(response.body.data.doctor).not.toHaveProperty('user');
    expect(response.body.data.doctor).not.toHaveProperty('licenseNumber');
    expect(response.body.data.slots).toHaveLength(1);
  });

  test('same idempotency key and payload replays, different payload is rejected', async () => {
    const firstSlot = await makeSlot();
    const secondSlot = await makeSlot();
    const key = randomUUID();
    const first = await booking.book(patient.id, firstSlot.id, key);
    const replay = await booking.book(patient.id, firstSlot.id, key);

    expect(replay.replayed).toBe(true);
    expect(replay.body.id).toBe(first.body.id);
    await expect(booking.book(patient.id, secondSlot.id, key)).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
  });

  test('cancellation releases a future slot but retains consultation history', async () => {
    const slot = await makeSlot();
    const booked = await booking.book(patient.id, slot.id, randomUUID());
    await booking.cancel({ userId: patient.id, role: 'PATIENT' }, booked.body.id);
    const reopened = await slot.reload();

    expect(reopened.status).toBe('OPEN');
    expect(await SlotReservation.count({ where: { slotId: slot.id } })).toBe(0);
    expect(await Consultation.findByPk(booked.body.id)).toMatchObject({ status: 'CANCELLED' });
    await expect(booking.book(secondPatient.id, slot.id, randomUUID())).resolves.toMatchObject({ replayed: false });
  });

  test('failed audit write rolls the booking and slot reservation back', async () => {
    const slot = await makeSlot();
    const originalCreate = AuditLog.create;
    AuditLog.create = async (data, options) => {
      if (data.eventType === 'CONSULTATION_BOOKED') throw new Error('simulated audit failure');
      return originalCreate.call(AuditLog, data, options);
    };
    try {
      await expect(booking.book(patient.id, slot.id, randomUUID())).rejects.toThrow('simulated audit failure');
    } finally {
      AuditLog.create = originalCreate;
    }
    await slot.reload();
    expect(slot.status).toBe('OPEN');
    expect(await Consultation.count({ where: { slotId: slot.id } })).toBe(0);
    expect(await SlotReservation.count({ where: { slotId: slot.id } })).toBe(0);
  });

  test('patients cannot read another patient consultation and doctors cannot mutate another doctor consultation', async () => {
    const slot = await makeSlot();
    const booked = await booking.book(patient.id, slot.id, randomUUID());
    const otherDoctorUser = await User.create({ email: `${randomUUID()}@doctor.test`, passwordHash: await bcrypt.hash('test-password-value', 4), role: 'DOCTOR' });
    await Doctor.create({ userId: otherDoctorUser.id, specialization: 'General Practice', licenseNumber: randomUUID(), verificationStatus: 'VERIFIED' });
    await expect(booking.getForActor({ userId: secondPatient.id, role: 'PATIENT' }, booked.body.id))
      .rejects.toMatchObject({ statusCode: 404 });
    await expect(booking.transition({ userId: otherDoctorUser.id, role: 'DOCTOR' }, booked.body.id, 'IN_PROGRESS'))
      .rejects.toMatchObject({ statusCode: 404 });
  });

  test('rejects invalid consultation state transitions', async () => {
    const slot = await makeSlot();
    const booked = await booking.book(patient.id, slot.id, randomUUID());
    await expect(booking.transition({ userId: doctorUser.id, role: 'DOCTOR' }, booked.body.id, 'COMPLETED'))
      .rejects.toMatchObject({ code: 'INVALID_STATE_TRANSITION' });
  });

  test('rejects invalid credentials and prevents patients from issuing prescriptions', async () => {
    await expect(auth.login({ email: patient.email, password: 'not-the-password' }))
      .rejects.toMatchObject({ code: 'INVALID_CREDENTIALS', statusCode: 401 });
    const slot = await makeSlot();
    const booked = await booking.book(patient.id, slot.id, randomUUID());
    await expect(prescriptions.create({ userId: patient.id, role: 'PATIENT' }, booked.body.id, { medications: [] }))
      .rejects.toMatchObject({ statusCode: 403 });
  });
});