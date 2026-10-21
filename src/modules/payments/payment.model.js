const { DataTypes, Model } = require('sequelize');
const sequelize = require('../../config/database');

class Payment extends Model {}

Payment.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    consultationId: { type: DataTypes.UUID, allowNull: false, unique: true, field: 'consultation_id' },
    amountMinor: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'amount_minor' },
    currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'INR' },
    status: { type: DataTypes.ENUM('PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED'), allowNull: false, defaultValue: 'PENDING' },
    providerReference: { type: DataTypes.STRING(191), allowNull: true, unique: true, field: 'provider_reference' },
  },
  { sequelize, modelName: 'Payment', tableName: 'payments', underscored: true },
);

module.exports = Payment;