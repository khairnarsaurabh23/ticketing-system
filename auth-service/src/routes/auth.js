'use strict';

const { Router } = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const authController = require('../controllers/authController');

const router = Router();

// POST /auth/register
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('name').trim().notEmpty().withMessage('Name is required'),
  ],
  validate,
  authController.register,
);

// POST /auth/login
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  authController.login,
);

// POST /auth/refresh
router.post(
  '/refresh',
  [body('refreshToken').notEmpty().withMessage('refreshToken is required')],
  validate,
  authController.refresh,
);

// POST /auth/logout
router.post('/logout', authController.logout);

// GET /auth/me — protected; gateway injects X-User-Id header
router.get('/me', authController.me);

module.exports = router;
