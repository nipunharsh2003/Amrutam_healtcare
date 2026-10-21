const { withTransientRetry } = require('../../src/utils/withTransientRetry');

describe('transient MySQL retry', () => {
  test('retries a deadlock with bounded exponential jitter', async () => {
    let calls = 0;
    const delays = [];
    const result = await withTransientRetry(async () => {
      calls += 1;
      if (calls < 3) throw { code: 'ER_LOCK_DEADLOCK' };
      return 'committed';
    }, {
      baseDelayMs: 20,
      maxDelayMs: 100,
      random: () => 0.5,
      sleep: async (delay) => delays.push(delay),
    });

    expect(result).toBe('committed');
    expect(calls).toBe(3);
    expect(delays).toEqual([20, 40]);
  });

  test('does not retry non-transient application errors', async () => {
    const operation = jest.fn().mockRejectedValue({ code: 'ER_DUP_ENTRY' });

    await expect(withTransientRetry(operation)).rejects.toMatchObject({ code: 'ER_DUP_ENTRY' });
    expect(operation).toHaveBeenCalledTimes(1);
  });
});