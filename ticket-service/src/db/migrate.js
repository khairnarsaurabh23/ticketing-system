'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });

const { getPool, createServiceLogger } = require('@ticketing/shared');

const logger = createServiceLogger('ticket-migrate');

const MIGRATIONS = [
  {
    name: '001_create_tickets_table',
    up: `
      CREATE TABLE IF NOT EXISTS tickets (
        id            CHAR(36)      NOT NULL,
        ticket_number VARCHAR(20)   NOT NULL,
        title         VARCHAR(255)  NOT NULL,
        description   TEXT          NOT NULL,
        priority      ENUM('low','medium','high','critical') NOT NULL DEFAULT 'medium',
        status        ENUM('open','in_progress','resolved','closed') NOT NULL DEFAULT 'open',
        category      VARCHAR(100)  DEFAULT NULL,
        created_by    CHAR(36)      NOT NULL,
        assigned_to   CHAR(36)      DEFAULT NULL,
        resolution    TEXT          DEFAULT NULL,
        resolved_at   DATETIME      DEFAULT NULL,
        resolved_by   CHAR(36)      DEFAULT NULL,
        created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY   (id),
        UNIQUE KEY    uq_ticket_number (ticket_number),
        KEY           idx_status       (status),
        KEY           idx_priority     (priority),
        KEY           idx_created_by   (created_by),
        KEY           idx_assigned_to  (assigned_to),
        KEY           idx_created_at   (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },
  {
    name: '002_create_ticket_comments_table',
    up: `
      CREATE TABLE IF NOT EXISTS ticket_comments (
        id          CHAR(36)  NOT NULL,
        ticket_id   CHAR(36)  NOT NULL,
        body        TEXT      NOT NULL,
        is_internal TINYINT(1) NOT NULL DEFAULT 0,
        author_id   CHAR(36)  NOT NULL,
        created_at  DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY         idx_ticket_id (ticket_id),
        CONSTRAINT  fk_tc_ticket  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },
  {
    name: '003_create_ticket_audit_log',
    up: `
      CREATE TABLE IF NOT EXISTS ticket_audit_log (
        id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        ticket_id   CHAR(36)        NOT NULL,
        actor_id    CHAR(36)        NOT NULL,
        action      VARCHAR(50)     NOT NULL,
        old_values  JSON            DEFAULT NULL,
        new_values  JSON            DEFAULT NULL,
        created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY         idx_ticket_id (ticket_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },
];

async function runMigrations() {
  const pool = getPool();

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
      logger.debug(`Migration ${migration.name} already applied`);
      continue;
    }
    logger.info(`Applying migration: ${migration.name}`);
    await pool.query(migration.up);
    await pool.execute('INSERT INTO schema_migrations (name) VALUES (?)', [migration.name]);
    logger.info(`Migration ${migration.name} done`);
  }

  logger.info('All ticket migrations complete');
}

if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error('Migration failed', { error: err.message });
      process.exit(1);
    });
}

module.exports = { runMigrations };
