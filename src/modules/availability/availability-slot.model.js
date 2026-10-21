const { DataTypes, Model } = require('sequelize');
const sequelize = require('../../config/database');

class AvailabilitySlot extends Model {}

AvailabilitySlot.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    doctorId: { type: DataTypes.UUID, allowNull: false, field: 'doctor_id' },
    startsAt: { type: DataTypes.DATE, allowNull: false, field: 'starts_at' },
    endsAt: { type: DataTypes.DATE, allowNull: false, field: 'ends_at' },
    status: { type: DataTypes.ENUM('OPEN', 'BOOKED', 'CANCELLED'), allowNull: false, defaultValue: 'OPEN' },
  },
  {
    sequelize,
    modelName: 'AvailabilitySlot',
    tableName: 'availability_slots',
    underscored: true,
    validate: {
      validInterval() {
        if (this.startsAt && this.endsAt && new Date(this.startsAt) >= new Date(this.endsAt)) {
          throw new Error('Slot start time must be before end time');
        }
      },
    },
    indexes: [{ fields: ['doctor_id', 'status', 'starts_at'], name: 'slots_search_idx' }],
  },
);

module.exports = AvailabilitySlot;