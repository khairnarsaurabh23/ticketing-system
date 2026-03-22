'use strict';

const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const morgan = require('morgan');
const { v4: uuidv4 } = require('uuid');

const { errorHandler, createServiceLogger } = require('@ticketing/shared');
const rateLimiter = require('./middleware/rateLimiter');
const authMiddleware = require('./middleware/auth');
const proxyRouter = require('./routes/proxy');
const healthRouter = require('./routes/health');

const logger = createServiceLogger('api-gateway');
const app = express();

// ─── Security & basics ────────────────────────────────────────────────────────
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
}));

// Assign request ID for distributed tracing
app.use((req, _res, next) => {
  req.id = req.headers['x-request-id'] || uuidv4();
  next();
});

// HTTP request logging
app.use(morgan(':method :url :status :res[content-length] - :response-time ms', {
  stream: { write: (msg) => logger.http(msg.trim()) },
}));

// Body parsing — only parse for health route (proxy passes raw body to services)
// DO NOT apply body parser globally — it consumes the stream before http-proxy-middleware can forward it
app.use('/health', express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Rate Limiting (applied globally) ────────────────────────────────────────
app.use(rateLimiter);

// ─── Public routes (no auth required) ────────────────────────────────────────
app.use('/health', healthRouter);

// Public auth endpoints — pathFilter inside proxy limits to /auth/login + /auth/register
app.use(proxyRouter.authPublicProxy);

// ─── From here all routes require a valid JWT ─────────────────────────────────
app.use(authMiddleware);

// Protected auth routes (/auth/me, /auth/refresh, /auth/logout)
// Mount at /auth so Express passes /me, /logout etc as req.url to the proxy
app.use('/auth', proxyRouter.authPrivateProxy);
// Ticket service — mount at /tickets
app.use('/tickets', proxyRouter.ticketProxy);

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use(errorHandler(logger));

module.exports = app;
