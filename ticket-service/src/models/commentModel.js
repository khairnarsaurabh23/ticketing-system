'use strict';

const { getPool } = require('@ticketing/shared');

const CommentModel = {
  async create({ id, ticketId, body, isInternal, authorId }) {
    const pool = getPool();
    await pool.execute(
      `INSERT INTO ticket_comments (id, ticket_id, body, is_internal, author_id, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [id, ticketId, body, isInternal ? 1 : 0, authorId],
    );
    return this.findById(id);
  },

  async findById(id) {
    const pool = getPool();
    const [rows] = await pool.execute(
      'SELECT * FROM ticket_comments WHERE id = ? LIMIT 1',
      [id],
    );
    return rows[0] || null;
  },

  async findByTicketId(ticketId) {
    const pool = getPool();
    const [rows] = await pool.execute(
      'SELECT * FROM ticket_comments WHERE ticket_id = ? ORDER BY created_at ASC',
      [ticketId],
    );
    return rows;
  },
};

module.exports = CommentModel;
