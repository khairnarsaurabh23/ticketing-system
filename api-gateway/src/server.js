'use strict';

const http = require('http');
const app = require('./app');
const { createServiceLogger } = require('@ticketing/shared');

const logger = createServiceLogger('api-gateway');
const PORT = parseInt(process.env.GATEWAY_PORT || '3000', 10);

let server;

async function start() {
  server = http.createServer(app);

  // Allow many concurrent keep-alive connections for high throughput
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 70_000;
  server.maxConnections = 0; // unlimited

  await new Promise((resolve, reject) => {
    server.listen(PORT, (err) => (err ? reject(err) : resolve()));
  });

  logger.info(`API Gateway worker ${process.pid} listening on port ${PORT}`);
  return server;
}

async function stop() {
  if (!server) return;
  await new Promise((resolve) => server.close(resolve));
  logger.info('API Gateway stopped');
}

module.exports = { start, stop };
