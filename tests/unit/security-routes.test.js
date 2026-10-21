const request = require('supertest');
const app = require('../../src/app');
const sequelize = require('../../src/config/database');

describe('security boundaries', () => {
  test('protected consultation endpoints reject anonymous requests', async () => {
    const response = await request(app).get('/api/v1/consultations');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  test('health liveness does not require MySQL', async () => {
    const response = await request(app).get('/health/live');

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('alive');
  });

  test('readiness reports database failure without exposing details', async () => {
    const authenticate = jest.spyOn(sequelize, 'authenticate').mockRejectedValue(new Error('database connection refused'));
    const response = await request(app).get('/health/ready');
    authenticate.mockRestore();

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('DATABASE_UNAVAILABLE');
    expect(JSON.stringify(response.body)).not.toMatch(/ECONNREFUSED|password|localhost/i);
  });

  test('metrics do not disclose output without the configured bearer token', async () => {
    const response = await request(app).get('/metrics');

    expect(response.status).toBe(401);
  });
});