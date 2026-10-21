const validation = require('../../src/modules/availability/availability.validation');

describe('availability slot validation', () => {
  test('rejects a start time at or after the end time', () => {
    const result = validation.create.shape.body.safeParse({
      doctorId: 'f3e3ad78-a270-4244-bac1-20bc470dadd0',
      startsAt: '2030-01-02T10:00:00Z',
      endsAt: '2030-01-02T10:00:00Z',
    });
    expect(result.success).toBe(false);
  });

  test('rejects slots in the past', () => {
    const result = validation.create.shape.body.safeParse({
      doctorId: 'f3e3ad78-a270-4244-bac1-20bc470dadd0',
      startsAt: '2020-01-02T10:00:00Z',
      endsAt: '2020-01-02T10:30:00Z',
    });
    expect(result.success).toBe(false);
  });
});