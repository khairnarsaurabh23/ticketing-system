'use strict';

const { getPool } = require('@ticketing/shared');

const ALLOWED_SORT = new Set(['created_at', 'updated_at', 'priority', 'status', 'ticket_number']);

const TicketModel = {
  async create({ id, ticketNumber, title, description, priority, category, status, createdBy }) {
    const pool = getPool();
    await pool.execute(
      `INSERT INTO tickets
         (id, ticket_number, title, description, priority, category, status, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [id, ticketNumber, title, description, priority, category, status, createdBy],
    );
    return this.findById(id);
  },

  async findById(id) {
    const pool = getPool();
    const [rows] = await pool.execute(
      'SELECT * FROM tickets WHERE id = ? LIMIT 1',
      [id],
    );
    return rows[0] || null;
  },

  async findAll({ offset = 0, limit = 20, status, priority, ownerId, sort = 'created_at', order = 'DESC' } = {}) {
    const pool = getPool();

    // Build dynamic WHERE
    const conditions = [];
    const params = [];

    if (status) { conditions.push('status = ?'); params.push(status); }
    if (priority) { conditions.push('priority = ?'); params.push(priority); }
    if (ownerId) { conditions.push('created_by = ?'); params.push(ownerId); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // Whitelist sort column to prevent SQL injection
    const sortCol = ALLOWED_SORT.has(sort) ? sort : 'created_at';
    const sortDir = order === 'ASC' ? 'ASC' : 'DESC';

    const [[countRow], [tickets]] = await Promise.all([
      pool.execute(
        `SELECT COUNT(*) AS total FROM tickets ${where}`,
        params,
      ),
      pool.execute(
        `SELECT * FROM tickets ${where} ORDER BY ${sortCol} ${sortDir} LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      ),
    ]);

    // mysql2 pool.query returns [[{total:N}], fields] — take first row safely
    const total = Number(Array.isArray(countRow) ? countRow[0]?.total : countRow?.total) || 0;

    return { tickets, total };
  },

  async update(id, updates) {
    const pool = getPool();

    const ALLOWED_COLUMNS = new Set([
      'title', 'description', 'priority', 'status', 'category',
      'assigned_to', 'resolution', 'resolved_at', 'resolved_by',
    ]);

    const sets = [];
    const values = [];

    for (const [col, val] of Object.entries(updates)) {
      if (ALLOWED_COLUMNS.has(col)) {
        sets.push(`${col} = ?`);
        values.push(val);
      }
    }

    if (sets.length === 0) return this.findById(id);

    sets.push('updated_at = NOW()');
    values.push(id);

    await pool.execute(
      `UPDATE tickets SET ${sets.join(', ')} WHERE id = ?`,
      values,
    );
    return this.findById(id);
  },

  async remove(id) {
    const pool = getPool();
    await pool.execute('DELETE FROM tickets WHERE id = ?', [id]);
  },
};

module.exports = TicketModel;
