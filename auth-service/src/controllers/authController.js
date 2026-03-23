'use strict';

const authService = require('../services/authService');
const { createServiceLogger } = require('@ticketing/shared');

const logger = createServiceLogger('auth-controller');

const authController = {
  async register(req, res, next) {
    try {
      const { email, password, name } = req.body;
      const result = await authService.register({ email, password, name });
      logger.info('User registered', { userId: result.user.id });
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const result = await authService.login({ email, password });
      logger.info('User logged in', { userId: result.user.id });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async refresh(req, res, next) {
    try {
      const { refreshToken } = req.body;
      const result = await authService.refreshTokens(refreshToken);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async logout(req, res, next) {
    try {
      const { refreshToken } = req.body;
      if (refreshToken) {
        await authService.logout(refreshToken);
      }
      res.json({ success: true, message: 'Logged out' });
    } catch (err) {
      next(err);
    }
  },

  async me(req, res, next) {
    try {
      // Gateway injects X-User-Id after verifying JWT
      const userId = req.headers['x-user-id'];
      if (!userId) {
        return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
      }
      const user = await authService.getUserById(userId);
      res.json({ success: true, data: { user } });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = authController;
