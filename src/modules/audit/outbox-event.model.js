const { DataTypes, Model } = require('sequelize');
const sequelize = require('../../config/database');

class OutboxEvent extends Model {}

OutboxEvent.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    eventType: { type: DataTypes.STRING(100), allowNull: false, field: 'event_type' },
    aggregateType: { type: DataTypes.STRING(80), allowNull: false, field: 'aggregate_type' },
    aggregateId: { type: DataTypes.STRING(64), allowNull: false, field: 'aggregate_id' },
    payload: { type: DataTypes.JSON, allowNull: false },
    status: {
      type: DataTypes.ENUM('PENDING', 'PROCESSING', 'DELIVERED', 'FAILED'),
      allowNull: false,
      defaultValue: 'PENDING',
    },
    attempts: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    availableAt: { type: DataTypes.DATE, allowNull: false, field: 'available_at' },
    lockedAt: { type: DataTypes.DATE, allowNull: true, field: 'locked_at' },
    lastErrorCode: { type: DataTypes.STRING(40), allowNull: true, field: 'last_error_code' },
  },
  {
    sequelize,
    modelName: 'OutboxEvent',
    tableName: 'outbox_events',
    underscored: true,
    indexes: [{ fields: ['status', 'available_at'], name: 'outbox_delivery_idx' }],
  },
);

module.exports = OutboxEvent;