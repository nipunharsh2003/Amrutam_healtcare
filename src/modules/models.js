const User = require('./users/user.model');
const Profile = require('./users/profile.model');
const Doctor = require('./doctors/doctor.model');
const AvailabilitySlot = require('./availability/availability-slot.model');
const Consultation = require('./consultations/consultation.model');
const IdempotencyKey = require('./consultations/idempotency-key.model');
const SlotReservation = require('./consultations/slot-reservation.model');
const Prescription = require('./prescriptions/prescription.model');
const Payment = require('./payments/payment.model');
const AuditLog = require('./audit/audit-log.model');

User.hasOne(Profile, { foreignKey: 'userId', as: 'profile' });
Profile.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasOne(Doctor, { foreignKey: 'userId', as: 'doctor' });
Doctor.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Doctor.hasMany(AvailabilitySlot, { foreignKey: 'doctorId', as: 'slots' });
AvailabilitySlot.belongsTo(Doctor, { foreignKey: 'doctorId', as: 'doctor' });
AvailabilitySlot.hasOne(Consultation, { foreignKey: 'slotId', as: 'consultation' });
Consultation.belongsTo(AvailabilitySlot, { foreignKey: 'slotId', as: 'slot' });
AvailabilitySlot.hasOne(SlotReservation, { foreignKey: 'slotId', as: 'reservation' });
SlotReservation.belongsTo(AvailabilitySlot, { foreignKey: 'slotId', as: 'slot' });
Consultation.hasOne(SlotReservation, { foreignKey: 'consultationId', as: 'reservation' });
SlotReservation.belongsTo(Consultation, { foreignKey: 'consultationId', as: 'consultation' });
User.hasMany(Consultation, { foreignKey: 'patientId', as: 'patientConsultations' });
Consultation.belongsTo(User, { foreignKey: 'patientId', as: 'patient' });
Doctor.hasMany(Consultation, { foreignKey: 'doctorId', as: 'consultations' });
Consultation.belongsTo(Doctor, { foreignKey: 'doctorId', as: 'doctor' });
Consultation.hasOne(Prescription, { foreignKey: 'consultationId', as: 'prescription' });
Prescription.belongsTo(Consultation, { foreignKey: 'consultationId', as: 'consultation' });
Consultation.hasOne(Payment, { foreignKey: 'consultationId', as: 'payment' });
Payment.belongsTo(Consultation, { foreignKey: 'consultationId', as: 'consultation' });
User.hasMany(AuditLog, { foreignKey: 'actorUserId', as: 'auditEvents' });
AuditLog.belongsTo(User, { foreignKey: 'actorUserId', as: 'actor' });

module.exports = {
  User,
  Profile,
  Doctor,
  AvailabilitySlot,
  Consultation,
  IdempotencyKey,
  SlotReservation,
  Prescription,
  Payment,
  AuditLog,
};