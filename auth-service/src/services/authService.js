'use strict';

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const UserModel = require('../models/userModel');
const { getRedisClient, createServiceLogger, ConflictError, UnauthorizedError, NotFoundError } = require('@ticketing/shared');

const logger = createServiceLogger('auth-service');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
const BCRYPT_ROUNDS = 12;

// Refresh token TTL in seconds (7 days)
const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60;

const authService = {
  /**
   * Register a new user.
   * Returns { user, accessToken, refreshToken }
   */
  async register({ email, password, name }) {
    const existing = await UserModel.findByEmail(email);
    if (existing) {
      throw new ConflictError(`User with email ${email} already exists`);
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const id = uuidv4();

    const user = await UserModel.create({ id, email, passwordHash, name, role: 'user' });
    logger.info('New user created', { userId: id });

    const { accessToken, refreshToken } = await this._issueTokens(user);
    return { user: this._sanitize(user), accessToken, refreshToken };
  },

  /**
   * Login an existing user.
   * Returns { user, accessToken, refreshToken }
   */
  async login({ email, password }) {
    const user = await UserModel.findByEmail(email);
    if (!user) throw new UnauthorizedError('Invalid email or password');

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw new UnauthorizedError('Invalid email or password');

    const { accessToken, refreshToken } = await this._issueTokens(user);
    logger.info('Login successful', { userId: user.id });
    return { user: this._sanitize(user), accessToken, refreshToken };
  },

  /**
   * Exchange a valid refresh token for a new access + refresh token pair.
   */
  async refreshTokens(refreshToken) {
    let payload;
    try {
      payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET, { algorithms: ['HS256'] });
    } catch {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    // Check if this refresh token is still valid in Redis
    const storedToken = await getRedisClient().get(`refresh:${payload.sub}`);
    if (storedToken !== refreshToken) {
      throw new UnauthorizedError('Refresh token has been revoked');
    }

    const user = await UserModel.findById(payload.sub);
    if (!user) throw new UnauthorizedError('User not found');

    const tokens = await this._issueTokens(user);
    return { ...tokens, user: this._sanitize(user) };
  },

  /**
   * Revoke a refresh token (logout).
   */
  async logout(refreshToken) {
    try {
      const payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET, { algorithms: ['HS256'] });
      await getRedisClient().del(`refresh:${payload.sub}`);
      logger.info('User logged out', { userId: payload.sub });
    } catch {
      // ignore invalid tokens on logout
    }
  },

  async getUserById(userId) {
    const user = await UserModel.findById(userId);
    if (!user) throw new NotFoundError('User');
    return this._sanitize(user);
  },

  // ─── Private helpers ────────────────────────────────────────────────────────

  async _issueTokens(user) {
    const payload = { sub: user.id, email: user.email, role: user.role };

    const accessToken = jwt.sign(payload, JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: JWT_EXPIRES_IN,
    });

    const refreshToken = jwt.sign({ sub: user.id }, JWT_REFRESH_SECRET, {
      algorithm: 'HS256',
      expiresIn: JWT_REFRESH_EXPIRES_IN,
    });

    // Persist refresh token in Redis (replaces previous token = single session)
    await getRedisClient().setex(`refresh:${user.id}`, REFRESH_TOKEN_TTL, refreshToken);

    return { accessToken, refreshToken };
  },

  _sanitize(user) {
    const { password_hash, ...safe } = user;
    return safe;
  },
};

module.exports = authService;
