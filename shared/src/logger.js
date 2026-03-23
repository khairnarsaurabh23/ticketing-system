'use strict';

const { createLogger, format, transports } = require('winston');

const { combine, timestamp, errors, printf, colorize } = format;

const logFormat = printf(({ level, message, timestamp: ts, stack, service, ...meta }) => {
  const svc = service ? `[${service}] ` : '';
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${ts} ${level}: ${svc}${stack || message}${metaStr}`;
});

/**
 * Creates a named logger.
 * @param {string} service - Service name shown in every log line.
 */
function createServiceLogger(service) {
  return createLogger({
    level: process.env.LOG_LEVEL || 'info',
    defaultMeta: { service },
    format: combine(
      colorize(),
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
      errors({ stack: true }),
      logFormat,
    ),
    transports: [
      new transports.Console(),
    ],
  });
}

module.exports = { createServiceLogger };
