'use strict';

const { createProxyMiddleware } = require('http-proxy-middleware');
const { createServiceLogger } = require('@ticketing/shared');

const logger = createServiceLogger('gateway:proxy');

const AUTH_TARGET = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
const TICKET_TARGET = process.env.TICKET_SERVICE_URL || 'http://localhost:3002';

/** Shared proxy event handlers */
function proxyEvents(label) {
  return {
    proxyReq(proxyReq, req) {
      proxyReq.setHeader('X-Request-Id', req.id || '');
      proxyReq.setHeader('X-Forwarded-For', req.ip || '');
      if (req.user) {
        proxyReq.setHeader('X-User-Id', String(req.user.sub || req.user.id || ''));
        proxyReq.setHeader('X-User-Role', String(req.user.role || 'user'));
        proxyReq.setHeader('X-User-Email', String(req.user.email || ''));
      }
    },
    proxyRes(proxyRes, req) {
      logger.debug(`[${label}] ${req.method} ${req.path} → ${proxyRes.statusCode}`);
    },
    error(err, req, res) {
      logger.error(`[${label}] Proxy error`, { error: err.message, path: req.path });
      if (!res.headersSent) {
        res.status(502).json({
          success: false,
          error: { code: 'BAD_GATEWAY', message: 'Upstream service unavailable' },
        });
      }
    },
  };
}

/**
 * Public auth proxy — no JWT required.
 * Handles /auth/login and /auth/register.
 * pathFilter ensures only these exact paths are proxied.
 */
const authPublicProxy = createProxyMiddleware({
  target: AUTH_TARGET,
  changeOrigin: true,
  pathFilter: ['/auth/login', '/auth/register'],
  proxyTimeout: 30_000,
  timeout: 30_000,
  on: proxyEvents('auth-public'),
});

/**
 * Private auth proxy — JWT required.
 * Mounted at /auth in app.js, so Express strips /auth from req.url.
 * pathRewrite restores it so auth service receives /auth/me, /auth/logout etc.
 */
const authPrivateProxy = createProxyMiddleware({
  target: AUTH_TARGET,
  changeOrigin: true,
  pathRewrite: { '^/': '/auth/' },
  proxyTimeout: 30_000,
  timeout: 30_000,
  on: proxyEvents('auth-private'),
});

/**
 * Ticket service proxy — JWT required.
 * Mounted at /tickets; pathRewrite restores the prefix.
 */
const ticketProxy = createProxyMiddleware({
  target: TICKET_TARGET,
  changeOrigin: true,
  pathRewrite: { '^/': '/tickets/' },
  proxyTimeout: 30_000,
  timeout: 30_000,
  on: proxyEvents('tickets'),
});

module.exports = { authPublicProxy, authPrivateProxy, ticketProxy };
