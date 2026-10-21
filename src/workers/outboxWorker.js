const { Op, Transaction } = require('sequelize');
const sequelize = require('../config/database');
const env = require('../config/env');
const logger = require('../utils/logger');
const { OutboxEvent } = require('../modules/models');

const MAX_ATTEMPTS = 10;
const POLL_INTERVAL_MS = 1000;
const LOCK_LEASE_MS = 30000;
const REQUEST_TIMEOUT_MS = 5000;

async function deliverEvent(event, endpoint, fetchImpl = fetch) {
  try {
    const response = await fetchImpl(endpoint.url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${endpoint.token}`,
        'content-type': 'application/json',
        'idempotency-key': event.id,
        'x-event-type': event.eventType,
      },
      body: JSON.stringify({
        id: event.id,
        eventType: event.eventType,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        payload: event.payload,
        occurredAt: event.createdAt,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (response.ok) return { delivered: true, retryable: false, errorCode: null };
    const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
    return { delivered: false, retryable, errorCode: `HTTP_${response.status}` };
  } catch (error) {
    const errorCode = error.name === 'TimeoutError' || error.name === 'AbortError' ? 'REQUEST_TIMEOUT' : 'TRANSPORT_ERROR';
    return { delivered: false, retryable: true, errorCode };
  }
}

function createOutboxWorker(options = {}) {
  const db = options.sequelize || sequelize;
  const Outbox = options.OutboxEvent || OutboxEvent;
  const endpoint = options.endpoint || {
    url: env.OUTBOX_WEBHOOK_URL,
    token: env.OUTBOX_WEBHOOK_TOKEN,
  };
  const fetchImpl = options.fetchImpl || fetch;
  const sleep = options.sleep || ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const random = options.random || Math.random;
  const maxAttempts = options.maxAttempts ?? MAX_ATTEMPTS;
  const pollIntervalMs = options.pollIntervalMs ?? POLL_INTERVAL_MS;
  let running = false;
  let loopPromise;

  async function claimNext() {
    return db.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED }, async (transaction) => {
      const now = new Date();
      const expiredLease = new Date(now.getTime() - LOCK_LEASE_MS);
      const event = await Outbox.findOne({
        where: {
          [Op.or]: [
            { status: 'PENDING', availableAt: { [Op.lte]: now } },
            { status: 'PROCESSING', lockedAt: { [Op.lt]: expiredLease } },
          ],
        },
        order: [['createdAt', 'ASC']],
        transaction,
        lock: transaction.LOCK.UPDATE,
        skipLocked: true,
      });
      if (!event) return null;
      await event.update({ status: 'PROCESSING', attempts: event.attempts + 1, lockedAt: now }, { transaction });
      return {
        id: event.id,
        eventType: event.eventType,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        payload: event.payload,
        createdAt: event.createdAt,
        attempts: event.attempts + 1,
      };
    });
  }

  async function processNext() {
    const event = await claimNext();
    if (!event) return false;

    const result = await deliverEvent(event, endpoint, fetchImpl);
    if (result.delivered) {
      await Outbox.update({ status: 'DELIVERED', lockedAt: null, lastErrorCode: null }, {
        where: { id: event.id, status: 'PROCESSING' },
      });
      return true;
    }

    const terminal = !result.retryable || event.attempts >= maxAttempts;
    const retryWindow = Math.min(15 * 60 * 1000, 1000 * (2 ** Math.min(event.attempts - 1, 10)));
    const delay = Math.floor(random() * retryWindow);
    await Outbox.update({
      status: terminal ? 'FAILED' : 'PENDING',
      availableAt: new Date(Date.now() + delay),
      lockedAt: null,
      lastErrorCode: result.errorCode,
    }, { where: { id: event.id, status: 'PROCESSING' } });
    logger.warn({ eventId: event.id, eventType: event.eventType, attempt: event.attempts, terminal, errorCode: result.errorCode }, 'Outbox delivery failed');
    return true;
  }

  async function run() {
    while (running) {
      try {
        const hadWork = await processNext();
        if (!hadWork && running) await sleep(pollIntervalMs);
      } catch (error) {
        logger.error({ errorName: error.name, errorCode: error.code }, 'Outbox polling failed');
        if (running) await sleep(pollIntervalMs);
      }
    }
  }

  return {
    start() {
      if (!endpoint.url || !endpoint.token || running) return;
      running = true;
      loopPromise = run();
      logger.info('Outbox worker started');
    },
    async stop() {
      running = false;
      if (loopPromise) await loopPromise;
    },
    processNext,
  };
}

module.exports = { createOutboxWorker, deliverEvent };