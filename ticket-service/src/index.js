'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const { startCluster } = require('@ticketing/shared');

startCluster({
  serviceName: 'ticket-service',
  numWorkers: parseInt(process.env.TICKET_WORKERS || '0', 10),
  workerFactory: async () => {
    if (process.env.RUN_MIGRATIONS === 'true') {
      const { runMigrations } = require('./db/migrate');
      await runMigrations();
    }
    return require('./server').start();
  },
});
