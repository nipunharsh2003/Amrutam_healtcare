module.exports = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/setupEnv.js'],
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: ['src/**/*.js', '!src/server.js', '!src/modules/models.js'],
  coverageDirectory: 'coverage',
};