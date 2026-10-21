const { Sequelize } = require('sequelize');
const env = require('./env');

const databaseName = env.NODE_ENV === 'test' ? env.TEST_DB_NAME : env.DB_NAME;
const sequelize = new Sequelize(databaseName, env.DB_USER, env.DB_PASSWORD, {
  host: env.DB_HOST,
  port: env.DB_PORT,
  dialect: 'mysql',
  logging: false,
  timezone: '+00:00',
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

module.exports = sequelize;