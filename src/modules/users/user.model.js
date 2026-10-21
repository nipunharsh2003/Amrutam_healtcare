const { DataTypes, Model } = require('sequelize');
const sequelize = require('../../config/database');

class User extends Model {}

User.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING(254),
      allowNull: false,
      unique: true,
      validate: { isEmail: true },
    },
    passwordHash: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'password_hash',
    },
    role: {
      type: DataTypes.ENUM('PATIENT', 'DOCTOR', 'ADMIN'),
      allowNull: false,
      defaultValue: 'PATIENT',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active',
    },
    mfaEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'mfa_enabled',
    },
    mfaSecretCiphertext: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'mfa_secret_ciphertext',
    },
    mfaSecretIv: {
      type: DataTypes.STRING(32),
      allowNull: true,
      field: 'mfa_secret_iv',
    },
    mfaSecretTag: {
      type: DataTypes.STRING(32),
      allowNull: true,
      field: 'mfa_secret_tag',
    },
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    underscored: true,
    timestamps: true,
  },
);

module.exports = User;