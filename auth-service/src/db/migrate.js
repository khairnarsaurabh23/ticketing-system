'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });

const { getPool, createServiceLogger } = require('@ticketing/shared');

const logger = createServiceLogger('auth-migrate');

const MIGRATIONS = [
  {
    name: '001_create_users_table',
    up: `
      CREATE TABLE IF NOT EXISTS users (
        id            CHAR(36)     NOT NULL,
        email         VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name          VARCHAR(100) NOT NULL,
        role          ENUM('user','agent','admin') NOT NULL DEFAULT 'user',
        created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY   (id),
        UNIQUE KEY    uq_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },
  {
    name: '002_create_migrations_table',
    up: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name        VARCHAR(255) NOT NULL,
        executed_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (name)
      ) ENGINE=InnoDB;
    `,
  },
];

async function runMigrations() {
  const pool = getPool();

  // Ensure schema_migrations table exists
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name        VARCHAR(255) NOT NULL,
      executed_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (name)
    ) ENGINE=InnoDB;
  `);

  for (const migration of MIGRATIONS) {
    const [rows] = await pool.execute(
      'SELECT name FROM schema_migrations WHERE name = ?',
      [migration.name],
    );

    if (rows.length > 0) {
      logger.debug(`Migration ${migration.name} already applied — skipping`);
      continue;
    }

    logger.info(`Applying migration: ${migration.name}`);
    await pool.query(migration.up);
    await pool.execute(
      'INSERT INTO schema_migrations (name) VALUES (?)',
      [migration.name],
    );
    logger.info(`Migration ${migration.name} applied`);
  }

  logger.info('All auth migrations complete');
}

// Allow running directly: node migrate.js
if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error('Migration failed', { error: err.message });
      process.exit(1);
    });
}

module.exports = { runMigrations };
