'use strict';

const { validationResult } = require('express-validator');
const { ValidationError } = require('@ticketing/shared');

/**
 * Express middleware that reads express-validator's result and
 * throws a ValidationError (→ 422) when rules fail.
 */
function validate(req, _res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const message = errors
      .array()
      .map((e) => e.msg)
      .join(', ');
    return next(new ValidationError(message));
  }
  next();
}

module.exports = validate;
