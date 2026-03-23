'use strict';

const { validationResult } = require('express-validator');
const { ValidationError } = require('@ticketing/shared');

function validate(req, _res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const message = errors.array().map((e) => e.msg).join(', ');
    return next(new ValidationError(message));
  }
  next();
}

module.exports = validate;
