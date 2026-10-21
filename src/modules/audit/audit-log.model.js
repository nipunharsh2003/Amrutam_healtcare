const { DataTypes, Model } = require('sequelize');
const sequelize = require('../../config/database');

class AuditLog extends Model {}

AuditLog.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    actorUserId: { type: DataTypes.UUID, allowNull: true, field: 'actor_user_id' },
    eventType: { type: DataTypes.STRING(80), allowNull: false, field: 'event_type' },
    targetType: { type: DataTypes.STRING(80), allowNull: true, field: 'target_type' },
    targetId: { type: DataTypes.STRING(64), allowNull: true, field: 'target_id' },
    metadata: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
    requestId: { type: DataTypes.STRING(64), allowNull: true, field: 'request_id' },
  },
  {
    sequelize,
    modelName: 'AuditLog',
    tableName: 'audit_logs',
    underscored: true,
    indexes: [{ fields: ['event_type', 'created_at'], name: 'audit_event_created_idx' }],
  },
);

module.exports = AuditLog;