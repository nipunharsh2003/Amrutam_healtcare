const { DataTypes, Model } = require('sequelize');
const sequelize = require('../../config/database');

class Consultation extends Model {}

Consultation.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    slotId: { type: DataTypes.UUID, allowNull: false, field: 'slot_id' },
    patientId: { type: DataTypes.UUID, allowNull: false, field: 'patient_id' },
    doctorId: { type: DataTypes.UUID, allowNull: false, field: 'doctor_id' },
    status: {
      type: DataTypes.ENUM('BOOKED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'),
      allowNull: false,
      defaultValue: 'BOOKED',
    },
    startedAt: { type: DataTypes.DATE, allowNull: true, field: 'started_at' },
    completedAt: { type: DataTypes.DATE, allowNull: true, field: 'completed_at' },
  },
  {
    sequelize,
    modelName: 'Consultation',
    tableName: 'consultations',
    underscored: true,
    indexes: [
      { fields: ['patient_id', 'created_at'], name: 'consultations_patient_created_idx' },
      { fields: ['doctor_id', 'status', 'created_at'], name: 'consultations_doctor_status_idx' },
      { fields: ['status', 'created_at'], name: 'consultations_status_created_idx' },
    ],
  },
);

module.exports = Consultation;