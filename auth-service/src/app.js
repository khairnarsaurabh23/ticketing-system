'use strict';

const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const morgan = require('morgan');
const { errorHandler, createServiceLogger } = require('@ticketing/shared');

const authRouter = require('./routes/auth');

const logger = createServiceLogger('auth-service');
const app = express();

app.use(helmet());
app.use(compression());
app.use(cors());
app.use(morgan('tiny', { stream: { write: (m) => logger.http(m.trim()) } }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/auth', authRouter);

app.get('/health', (_req, res) => {
  res.json({ service: 'auth-service', pid: process.pid, status: 'up' });
});

// ─── 404 ─────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } });
});

app.use(errorHandler(logger));

module.exports = app;
