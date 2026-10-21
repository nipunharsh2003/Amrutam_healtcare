const { DataTypes, Model } = require('sequelize');
const sequelize = require('../../config/database');

class SlotReservation extends Model {}

SlotReservation.init(
  {
    slotId: { type: DataTypes.UUID, primaryKey: true, allowNull: false, field: 'slot_id' },
    consultationId: { type: DataTypes.UUID, allowNull: false, unique: true, field: 'consultation_id' },
  },
  { sequelize, modelName: 'SlotReservation', tableName: 'slot_reservations', underscored: true },
);

module.exports = SlotReservation;