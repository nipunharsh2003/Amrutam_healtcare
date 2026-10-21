const { DataTypes, Model } = require('sequelize');
const sequelize = require('../../config/database');

class Doctor extends Model {}

Doctor.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false, unique: true, field: 'user_id' },
    specialization: { type: DataTypes.STRING(120), allowNull: false },
    bio: { type: DataTypes.TEXT, allowNull: true },
    licenseNumber: { type: DataTypes.STRING(100), allowNull: false, unique: true, field: 'license_number' },
    verificationStatus: {
      type: DataTypes.ENUM('PENDING', 'VERIFIED', 'REJECTED'),
      allowNull: false,
      defaultValue: 'PENDING',
      field: 'verification_status',
    },
  },
  { sequelize, modelName: 'Doctor', tableName: 'doctors', underscored: true },
);

module.exports = Doctor;