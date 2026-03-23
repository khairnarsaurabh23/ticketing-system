'use strict';

const Redis = require('ioredis');
const { createServiceLogger } = require('./logger');

const logger = createServiceLogger('redis');

let client = null;

/**
 * Returns a singleton Redis client.
 */
function getRedisClient() {
  if (client) return client;

  client = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: false,
    retryStrategy(times) {
      const delay = Math.min(100 * 2 ** times, 5000);
      logger.warn(`Redis retry attempt ${times}, waiting ${delay}ms`);
      return delay;
    },
    reconnectOnError(err) {
      const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
      return targetErrors.some((e) => err.message.includes(e));
    },
  });

  client.on('connect', () => logger.info('Redis connected'));
  client.on('ready', () => logger.info('Redis ready'));
  client.on('error', (err) => logger.error('Redis error', { error: err.message }));
  client.on('close', () => logger.warn('Redis connection closed'));
  client.on('reconnecting', () => logger.warn('Redis reconnecting...'));

  return client;
}

/**
 * Creates a dedicated Redis client used by Redlock.
 */
function createRedisClient() {
  return new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: false,
    retryStrategy(times) {
      return Math.min(100 * 2 ** times, 5000);
    },
  });
}

module.exports = { getRedisClient, createRedisClient };
