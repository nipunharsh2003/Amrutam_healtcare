const { DataTypes, Model } = require('sequelize');
const sequelize = require('../../config/database');

class Prescription extends Model {}

Prescription.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    consultationId: { type: DataTypes.UUID, allowNull: false, unique: true, field: 'consultation_id' },
    patientId: { type: DataTypes.UUID, allowNull: false, field: 'patient_id' },
    doctorId: { type: DataTypes.UUID, allowNull: false, field: 'doctor_id' },
    detailsCiphertext: { type: DataTypes.TEXT, allowNull: false, field: 'details_ciphertext' },
    detailsIv: { type: DataTypes.STRING(32), allowNull: false, field: 'details_iv' },
    detailsTag: { type: DataTypes.STRING(32), allowNull: false, field: 'details_tag' },
    createdBy: { type: DataTypes.UUID, allowNull: false, field: 'created_by' },
  },
  { sequelize, modelName: 'Prescription', tableName: 'prescriptions', underscored: true },
);

module.exports = Prescription;