'use strict';

const Redlock = require('redlock');
const { createRedisClient } = require('./redisClient');
const { createServiceLogger } = require('./logger');

const logger = createServiceLogger('redlock');

let redlockInstance = null;

/**
 * Returns a singleton Redlock instance backed by Redis.
 */
function getRedlock() {
  if (redlockInstance) return redlockInstance;

  const redisClient = createRedisClient();

  redlockInstance = new Redlock([redisClient], {
    // clock drift factor — 0.01 = 1%
    driftFactor: parseFloat(process.env.REDLOCK_DRIFT_FACTOR || '0.01'),
    // max number of attempts to acquire a lock
    retryCount: parseInt(process.env.REDLOCK_RETRY_COUNT || '10', 10),
    // base delay between retries (ms)
    retryDelay: parseInt(process.env.REDLOCK_RETRY_DELAY || '200', 10),
    // additional random jitter subtracted from delay (ms)
    retryJitter: parseInt(process.env.REDLOCK_RETRY_JITTER || '200', 10),
    // minimum time remaining before auto-extending
    automaticExtensionThreshold: 500,
  });

  redlockInstance.on('error', (err) => {
    // expected when competing clients cannot acquire a lock — suppress noise
    if (!err.message.includes('LockError')) {
      logger.error('Redlock error', { error: err.message });
    }
  });

  logger.info('Redlock initialised');
  return redlockInstance;
}

/**
 * Convenience wrapper: acquire a lock, execute an async function, then release.
 *
 * @param {string|string[]} resources  - Lock key(s)
 * @param {number}          duration   - Max lock duration in ms
 * @param {Function}        fn         - Async function to execute while lock is held
 * @returns {Promise<*>}               - Return value of fn
 */
async function withLock(resources, duration, fn) {
  const lock = await getRedlock().acquire(
    Array.isArray(resources) ? resources : [resources],
    duration,
  );
  try {
    return await fn();
  } finally {
    await lock.release().catch((err) =>
      logger.warn('Failed to release lock', { error: err.message }),
    );
  }
}

module.exports = { getRedlock, withLock };
