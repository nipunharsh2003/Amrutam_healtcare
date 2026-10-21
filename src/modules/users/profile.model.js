const { DataTypes, Model } = require('sequelize');
const sequelize = require('../../config/database');

class Profile extends Model {}

Profile.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false, unique: true, field: 'user_id' },
    firstName: { type: DataTypes.STRING(100), allowNull: false, field: 'first_name' },
    lastName: { type: DataTypes.STRING(100), allowNull: false, field: 'last_name' },
    phone: { type: DataTypes.STRING(30), allowNull: true },
  },
  { sequelize, modelName: 'Profile', tableName: 'profiles', underscored: true },
);

module.exports = Profile;