'use strict';

const router = require('express').Router();
const { getRedisClient } = require('@ticketing/shared');
const { getPool } = require('@ticketing/shared');

router.get('/', async (_req, res) => {
  const checks = {};
  let httpStatus = 200;

  // Redis health check
  try {
    const pong = await getRedisClient().ping();
    checks.redis = { status: pong === 'PONG' ? 'up' : 'degraded' };
  } catch (err) {
    checks.redis = { status: 'down', error: err.message };
    httpStatus = 503;
  }

  // MySQL health check
  try {
    await getPool().query('SELECT 1');
    checks.mysql = { status: 'up' };
  } catch (err) {
    checks.mysql = { status: 'down', error: err.message };
    httpStatus = 503;
  }

  res.status(httpStatus).json({
    service: 'api-gateway',
    pid: process.pid,
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    checks,
  });
});

module.exports = router;
