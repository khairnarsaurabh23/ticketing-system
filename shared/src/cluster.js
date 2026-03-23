'use strict';

const cluster = require('cluster');
const os = require('os');
const { createServiceLogger } = require('./logger');

/**
 * Runs the given factory in cluster master/worker mode.
 *
 * - Master forks `numWorkers` workers and restarts them on unexpected exit.
 * - Each worker calls `workerFactory()` to start its HTTP server.
 *
 * @param {object}   options
 * @param {string}   options.serviceName    - Used for logging.
 * @param {number}  [options.numWorkers=0]  - 0 = os.cpus().length
 * @param {Function} options.workerFactory  - Async function called in each worker.
 */
function startCluster({ serviceName, numWorkers = 0, workerFactory }) {
  const logger = createServiceLogger(serviceName);
  const workers = numWorkers > 0 ? numWorkers : os.cpus().length;

  if (cluster.isPrimary) {
    logger.info(`Master ${process.pid} starting ${workers} workers`);

    for (let i = 0; i < workers; i++) {
      cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
      logger.warn(`Worker ${worker.process.pid} died (${signal || code}). Restarting…`);
      cluster.fork();
    });

    cluster.on('online', (worker) => {
      logger.info(`Worker ${worker.process.pid} is online`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('Master received SIGTERM, shutting down workers…');
      for (const w of Object.values(cluster.workers)) {
        w.send('shutdown');
      }
      setTimeout(() => process.exit(0), 5000);
    });
  } else {
    // Worker
    process.on('message', (msg) => {
      if (msg === 'shutdown') {
        logger.info(`Worker ${process.pid} gracefully shutting down`);
        process.exit(0);
      }
    });

    workerFactory().catch((err) => {
      logger.error(`Worker ${process.pid} startup failed`, { error: err.message });
      process.exit(1);
    });
  }
}

module.exports = { startCluster };
