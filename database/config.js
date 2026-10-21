require('dotenv').config();

const common = {
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  dialect: 'mysql',
  timezone: '+00:00',
};

module.exports = {
  development: { ...common, database: process.env.DB_NAME },
  test: { ...common, database: process.env.TEST_DB_NAME },
  production: { ...common, database: process.env.DB_NAME },
};