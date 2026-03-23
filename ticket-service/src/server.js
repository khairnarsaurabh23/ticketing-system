'use strict';

const http = require('http');
const app = require('./app');
const { createServiceLogger } = require('@ticketing/shared');

const logger = createServiceLogger('ticket-service');
const PORT = parseInt(process.env.TICKET_PORT || '3002', 10);

let server;

async function start() {
  server = http.createServer(app);
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 70_000;

  await new Promise((resolve, reject) => {
    server.listen(PORT, (err) => (err ? reject(err) : resolve()));
  });

  logger.info(`Ticket Service worker ${process.pid} listening on port ${PORT}`);
  return server;
}

async function stop() {
  if (!server) return;
  await new Promise((resolve) => server.close(resolve));
}

module.exports = { start, stop };
