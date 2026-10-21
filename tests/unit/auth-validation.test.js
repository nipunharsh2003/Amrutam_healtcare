const validation = require('../../src/modules/auth/auth.validation');

describe('registration validation', () => {
  test('normalizes email and does not permit role self-assignment', () => {
    const result = validation.register.shape.body.safeParse({
      email: '  PATIENT@example.test ',
      password: 'a-long-test-password',
      firstName: 'Patient',
      lastName: 'Example',
      role: 'ADMIN',
    });

    expect(result.success).toBe(false);
  });

  test('accepts a valid patient registration and normalizes email', () => {
    const result = validation.register.shape.body.safeParse({
      email: '  PATIENT@example.test ',
      password: 'a-long-test-password',
      firstName: 'Patient',
      lastName: 'Example',
    });

    expect(result.success).toBe(true);
    expect(result.data.email).toBe('patient@example.test');
  });
});