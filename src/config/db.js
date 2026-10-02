import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

const configuredPath = process.env.SQLITE_PATH || 'data/dwm.sqlite';
export const databasePath = path.isAbsolute(configuredPath)
  ? configuredPath
  : path.join(rootDir, configuredPath);

fs.mkdirSync(path.dirname(databasePath), { recursive: true });

export const db = new DatabaseSync(databasePath);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 5000;
  PRAGMA temp_store = MEMORY;

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT
  );

  -- Internal compatibility table only. Maintenance UI was retired in v0.9,
  -- but legacy assets_list.id_pm_category is NOT NULL.
  CREATE TABLE IF NOT EXISTS pm_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    notes TEXT,
    created_at TEXT,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_password_reset_user
    ON password_reset_tokens(user_id);

  CREATE INDEX IF NOT EXISTS idx_password_reset_expiry
    ON password_reset_tokens(expires_at, used_at);

  CREATE TABLE IF NOT EXISTS user_security (
    user_id INTEGER PRIMARY KEY,
    session_version INTEGER NOT NULL DEFAULT 1,
    password_changed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    method TEXT,
    path TEXT,
    status_code INTEGER,
    ip_address TEXT,
    user_agent TEXT,
    metadata TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_audit_created
    ON audit_logs(created_at DESC);

  CREATE INDEX IF NOT EXISTS idx_audit_user
    ON audit_logs(user_id, created_at DESC);

  CREATE INDEX IF NOT EXISTS idx_audit_action
    ON audit_logs(action, created_at DESC);
`);

function rawTableExists(name) {
  return Boolean(db.prepare(
    `SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1`
  ).get(name));
}

function ensureColumn(table, column, definition) {
  if (!rawTableExists(table)) return;
  const columns = new Set(db.prepare(`PRAGMA table_info("${table}")`).all().map(row => row.name));
  if (!columns.has(column)) {
    db.exec(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${definition}`);
  }
}

if (rawTableExists('wellinfo')) {
  ensureColumn('wellinfo', 'validation_status', "TEXT NOT NULL DEFAULT 'DRAFT'");
  ensureColumn('wellinfo', 'created_by_user_id', 'INTEGER');
  ensureColumn('wellinfo', 'submitted_at', 'TEXT');
  ensureColumn('wellinfo', 'validated_by_user_id', 'INTEGER');
  ensureColumn('wellinfo', 'validated_at', 'TEXT');

  db.exec(`
    UPDATE wellinfo
    SET validation_status = CASE
      WHEN lockreport = 'YES' THEN 'VALIDATED'
      WHEN COALESCE(validation_status, '') IN ('DRAFT','PENDING','VALIDATED') THEN validation_status
      ELSE 'DRAFT'
    END;

    CREATE INDEX IF NOT EXISTS idx_wellinfo_validation
      ON wellinfo(id_project, validation_status, curdate);
  `);
}

if (rawTableExists('assets_list')) {
  ensureColumn('assets_list', 'id_project', 'INTEGER');
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_assets_project
      ON assets_list(id_project, asset_name);
  `);
}

// Report access codes are retired in v0.9. Authorization is role/project based.
if (rawTableExists('projects')) {
  db.exec(`UPDATE projects SET kodeakses = NULL WHERE kodeakses IS NOT NULL;`);
}

export function all(sql, params = []) {
  return db.prepare(sql).all(...params);
}

export function get(sql, params = []) {
  return db.prepare(sql).get(...params);
}

export function run(sql, params = []) {
  return db.prepare(sql).run(...params);
}

export function transaction(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch {}
    throw error;
  }
}

export function pingDatabase() {
  return get('SELECT 1 AS ok')?.ok === 1;
}

export function tableExists(name) {
  return Boolean(get(
    `SELECT 1
     FROM sqlite_master
     WHERE type = 'table' AND name = ?
     LIMIT 1`,
    [name]
  ));
}
