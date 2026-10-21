const { DataTypes, Model } = require('sequelize');
const sequelize = require('../../config/database');

class IdempotencyKey extends Model {}

IdempotencyKey.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
    key: { type: DataTypes.STRING(128), allowNull: false },
    requestHash: { type: DataTypes.STRING(64), allowNull: false, field: 'request_hash' },
    responseBody: { type: DataTypes.JSON, allowNull: true, field: 'response_body' },
    expiresAt: { type: DataTypes.DATE, allowNull: false, field: 'expires_at' },
  },
  {
    sequelize,
    modelName: 'IdempotencyKey',
    tableName: 'idempotency_keys',
    underscored: true,
    indexes: [
      { unique: true, fields: ['user_id', 'key'], name: 'idempotency_user_key_uq' },
      { fields: ['expires_at'], name: 'idempotency_expires_idx' },
    ],
  },
);

module.exports = IdempotencyKey;