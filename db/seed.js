'use strict';
/**
 * Seed script — creates test users so the load-test can obtain a JWT.
 *
 * Run:
 *   node db/seed.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const { getPool, createServiceLogger } = require('@ticketing/shared');

const logger = createServiceLogger('seed');

async function seed() {
  const pool = getPool();

  const users = [
    { email: 'admin@example.com', name: 'Admin User', password: 'Admin123!', role: 'admin' },
    { email: 'agent@example.com', name: 'Support Agent', password: 'Agent123!', role: 'agent' },
    { email: 'loadtest@example.com', name: 'Load Test User', password: 'LoadTest123!', role: 'user' },
    { email: 'user@example.com', name: 'Regular User', password: 'User1234!', role: 'user' },
  ];

  for (const u of users) {
    const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [u.email]);
    if (existing.length > 0) {
      logger.info(`User ${u.email} already exists — skipping`);
      continue;
    }

    const passwordHash = await bcrypt.hash(u.password, 12);
    const id = uuidv4();
    await pool.execute(
      `INSERT INTO users (id, email, password_hash, name, role, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [id, u.email, passwordHash, u.name, u.role],
    );
    logger.info(`Seeded user: ${u.email} (${u.role})`);
  }

  logger.info('Seed complete');
  process.exit(0);
}

seed().catch((err) => {
  logger.error('Seed failed', { error: err.message });
  process.exit(1);
});
