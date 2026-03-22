'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const { startCluster } = require('@ticketing/shared');

startCluster({
  serviceName: 'api-gateway',
  numWorkers: parseInt(process.env.GATEWAY_WORKERS || '0', 10),
  workerFactory: () => require('./server').start(),
});
