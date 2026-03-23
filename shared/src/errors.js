'use strict';

/** Base class for domain errors — keeps HTTP status codes close to the error. */
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

class ValidationError extends AppError {
  constructor(message) {
    super(message, 422, 'VALIDATION_ERROR');
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

class ConflictError extends AppError {
  constructor(message) {
    super(message, 409, 'CONFLICT');
  }
}

class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429, 'TOO_MANY_REQUESTS');
  }
}

/**
 * Express error-handling middleware.
 * Must be registered LAST with app.use().
 */
function errorHandler(logger) {
  // eslint-disable-next-line no-unused-vars
  return function (err, req, res, next) {
    const statusCode = err.statusCode || 500;
    const code = err.code || 'INTERNAL_ERROR';

    if (statusCode >= 500) {
      logger.error('Unhandled error', {
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
      });
    } else {
      logger.warn('Client error', {
        message: err.message,
        code,
        path: req.path,
        method: req.method,
      });
    }

    res.status(statusCode).json({
      success: false,
      error: {
        code,
        message: statusCode >= 500 && process.env.NODE_ENV === 'production'
          ? 'Internal server error'
          : err.message,
      },
    });
  };
}

module.exports = {
  AppError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  TooManyRequestsError,
  errorHandler,
};
