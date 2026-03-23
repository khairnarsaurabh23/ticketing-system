'use strict';

const mysql = require('mysql2/promise');
const { createServiceLogger } = require('./logger');

const logger = createServiceLogger('mysql');

let pool = null;

/**
 * Returns a singleton MySQL connection pool.
 */
function getPool() {
  if (pool) return pool;

  pool = mysql.createPool({
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT || '3306', 10),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'ticketing_db',
    // Each worker process gets its own pool — total connections per node =
    // MYSQL_CONNECTION_LIMIT * workers. Keep at 20–25 per worker.
    connectionLimit: parseInt(process.env.MYSQL_CONNECTION_LIMIT || '25', 10),
    queueLimit: 0,               // unlimited queuing
    waitForConnections: true,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    // namedPlaceholders for readable queries
    namedPlaceholders: true,
    // avoid timezone drift
    timezone: 'Z',
    // auto-parse dates
    dateStrings: false,
    // SSL in production
    ssl: process.env.NODE_ENV === 'production' && process.env.MYSQL_SSL === 'true'
      ? { rejectUnauthorized: true }
      : undefined,
  });

  pool.on('acquire', () => logger.debug('MySQL connection acquired'));
  pool.on('release', () => logger.debug('MySQL connection released'));

  logger.info('MySQL pool created', {
    host: process.env.MYSQL_HOST,
    database: process.env.MYSQL_DATABASE,
    connectionLimit: process.env.MYSQL_CONNECTION_LIMIT || 25,
  });

  return pool;
}

/**
 * Run a function inside a MySQL transaction.
 * Rolls back automatically on error.
 *
 * @param {Function} fn - Receives a db connection; must return a Promise.
 * @returns {Promise<*>}
 */
async function withTransaction(fn) {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { getPool, withTransaction };
