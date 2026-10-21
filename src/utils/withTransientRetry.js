const RETRYABLE_CODES = new Set(['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT']);

function isRetryableDatabaseError(error) {
  for (let current = error; current; current = current.parent || current.original || current.cause) {
    if (RETRYABLE_CODES.has(current.code)) return true;
  }
  return false;
}

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function withTransientRetry(operation, options = {}) {
  const maxAttempts = options.maxAttempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 25;
  const maxDelayMs = options.maxDelayMs ?? 500;
  const random = options.random || Math.random;
  const sleep = options.sleep || wait;

  for (let attempt = 1; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= maxAttempts || !isRetryableDatabaseError(error)) throw error;
      const exponentialDelay = Math.min(maxDelayMs, baseDelayMs * (2 ** (attempt - 1)));
      await sleep(Math.floor(exponentialDelay * (0.5 + random())));
    }
  }
}

module.exports = { withTransientRetry, isRetryableDatabaseError };