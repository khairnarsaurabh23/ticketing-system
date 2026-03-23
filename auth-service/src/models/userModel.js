'use strict';

const { getPool } = require('@ticketing/shared');

const UserModel = {
  async create({ id, email, passwordHash, name, role = 'user' }) {
    const pool = getPool();
    await pool.execute(
      `INSERT INTO users (id, email, password_hash, name, role, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [id, email, passwordHash, name, role],
    );
    return this.findById(id);
  },

  async findByEmail(email) {
    const pool = getPool();
    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE email = ? LIMIT 1',
      [email],
    );
    return rows[0] || null;
  },

  async findById(id) {
    const pool = getPool();
    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE id = ? LIMIT 1',
      [id],
    );
    return rows[0] || null;
  },

  async updatePassword(id, passwordHash) {
    const pool = getPool();
    await pool.execute(
      'UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?',
      [passwordHash, id],
    );
  },
};

module.exports = UserModel;
