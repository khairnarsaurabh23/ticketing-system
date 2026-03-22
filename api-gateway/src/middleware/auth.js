'use strict';

const jwt = require('jsonwebtoken');
const { createServiceLogger, UnauthorizedError } = require('@ticketing/shared');

const logger = createServiceLogger('gateway:auth');
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  logger.error('JWT_SECRET is not set! Gateway is insecure.');
}

/**
 * Express middleware that validates a Bearer JWT on every incoming request.
 * Attaches decoded payload to `req.user` and forwards `X-User-*` headers
 * to downstream services so they don't need to re-verify.
 */
function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or malformed Authorization header');
    }

    const token = authHeader.slice(7);

    const payload = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
      // grace period for clock skew
      clockTolerance: 30,
    });

    // Attach user info so downstream services can trust headers
    req.user = payload;
    req.headers['x-user-id'] = String(payload.sub || payload.id);
    req.headers['x-user-email'] = String(payload.email || '');
    req.headers['x-user-role'] = String(payload.role || 'user');
    req.headers['x-request-id'] = req.id;

    logger.debug('Token valid', { userId: payload.sub });
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new UnauthorizedError('Token expired'));
    }
    if (err.name === 'JsonWebTokenError') {
      return next(new UnauthorizedError(`Invalid token: ${err.message}`));
    }
    next(err);
  }
}

module.exports = authMiddleware;
