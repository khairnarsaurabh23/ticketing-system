-- ──────────────────────────────────────────────────────────────────────────────
-- Bootstrap script executed once when the MySQL container first starts.
-- Individual services run their own schema migrations on startup.
-- ──────────────────────────────────────────────────────────────────────────────

CREATE DATABASE IF NOT EXISTS ticketing_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE ticketing_db;

-- Global performance settings
SET GLOBAL max_connections = 500;
SET GLOBAL innodb_buffer_pool_size = 268435456;   -- 256 MB

-- Confirm setup
SELECT 'ticketing_db bootstrap complete' AS status;
