'use strict';

const rateLimit = require('express-rate-limit');
const { getRedisClient, createServiceLogger } = require('@ticketing/shared');

const logger = createServiceLogger('gateway:rate-limiter');

const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);
const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX || '200', 10);

const { RedisStore } = require('rate-limit-redis');

logger.info(`Rate limiter: ${MAX_REQUESTS} req / ${WINDOW_MS / 1000}s per IP (store: redis)`);

/**
 * Build a Redis-backed store for rate-limit.
 */
function makeStore(prefix) {
  return new RedisStore({
    sendCommand: (...args) => getRedisClient().call(...args),
    prefix,
  });
}

// Low-tolerance limiter for auth endpoints (brute-force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: makeStore('rl:auth:'),
  keyGenerator: (req) => req.ip || 'unknown',
  handler(_req, res) {
    res.status(429).json({
      success: false,
      error: { code: 'TOO_MANY_REQUESTS', message: 'Too many authentication attempts. Try again later.' },
    });
  },
  skip: (req) => !req.path.includes('login') && !req.path.includes('register'),
});

// Global limiter
const globalLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: MAX_REQUESTS,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: makeStore('rl:global:'),
  keyGenerator: (req) => {
    const userId = req.headers['x-user-id'];
    return userId || req.ip || 'unknown';
  },
  handler(_req, res) {
    res.status(429).json({
      success: false,
      error: { code: 'TOO_MANY_REQUESTS', message: 'Rate limit exceeded. Slow down.' },
    });
  },
});

function rateLimiter(req, res, next) {
  authLimiter(req, res, (err) => {
    if (err) return next(err);
    globalLimiter(req, res, next);
  });
}

module.exports = rateLimiter;
