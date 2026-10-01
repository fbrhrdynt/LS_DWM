import crypto from 'node:crypto';
import { get, run, transaction } from '../config/db.js';

function resetTtlMinutes() {
  const raw = Number(process.env.PASSWORD_RESET_TTL_MINUTES || 15);
  return Number.isFinite(raw) ? Math.min(120, Math.max(5, Math.trunc(raw))) : 15;
}

export function hashResetToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

export function ensureUserSecurity(userId) {
  run(
    `INSERT OR IGNORE INTO user_security (user_id, session_version)
     VALUES (?, 1)`,
    [userId]
  );

  return get(
    `SELECT user_id, session_version, password_changed_at
     FROM user_security
     WHERE user_id = ?
     LIMIT 1`,
    [userId]
  );
}

export function getSessionVersion(userId) {
  return Number(ensureUserSecurity(userId)?.session_version || 1);
}

export function bumpSessionVersion(userId) {
  ensureUserSecurity(userId);

  run(
    `UPDATE user_security
     SET session_version = session_version + 1,
         password_changed_at = datetime('now')
     WHERE user_id = ?`,
    [userId]
  );

  return getSessionVersion(userId);
}

export function createPasswordResetToken(userId) {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashResetToken(rawToken);
  const ttl = resetTtlMinutes();
  const expiresAt = get(
    `SELECT datetime('now', ?) AS expires_at`,
    [`+${ttl} minutes`]
  )?.expires_at;

  transaction(() => {
    run(
      `UPDATE password_reset_tokens
       SET used_at = COALESCE(used_at, datetime('now'))
       WHERE user_id = ? AND used_at IS NULL`,
      [userId]
    );

    run(
      `INSERT INTO password_reset_tokens
       (user_id, token_hash, expires_at)
       VALUES (?, ?, ?)`,
      [userId, tokenHash, expiresAt]
    );
  });

  return { token: rawToken, expiresAt, ttlMinutes: ttl };
}

export function findValidResetToken(rawToken) {
  const tokenHash = hashResetToken(rawToken);

  return get(
    `SELECT
       t.id,
       t.user_id,
       t.expires_at,
       u.employee_name,
       u.email,
       u.status
     FROM password_reset_tokens t
     JOIN xusers u ON u.id_user = t.user_id
     WHERE t.token_hash = ?
       AND t.used_at IS NULL
       AND t.expires_at > datetime('now')
     LIMIT 1`,
    [tokenHash]
  );
}

export function consumeResetToken(rawToken, passwordHash) {
  const tokenHash = hashResetToken(rawToken);

  return transaction(() => {
    const record = get(
      `SELECT t.id, t.user_id
       FROM password_reset_tokens t
       JOIN xusers u ON u.id_user = t.user_id
       WHERE t.token_hash = ?
         AND t.used_at IS NULL
         AND t.expires_at > datetime('now')
       LIMIT 1`,
      [tokenHash]
    );

    if (!record) return null;

    run(
      `UPDATE xusers
       SET pass_login = ?
       WHERE id_user = ?`,
      [passwordHash, record.user_id]
    );

    run(
      `UPDATE password_reset_tokens
       SET used_at = datetime('now')
       WHERE id = ?`,
      [record.id]
    );

    const nextVersion = bumpSessionVersion(record.user_id);
    return { userId: record.user_id, sessionVersion: nextVersion };
  });
}

export function purgeExpiredSecurityData(auditRetentionDays = 180) {
  const days = Number.isFinite(Number(auditRetentionDays))
    ? Math.min(3650, Math.max(30, Math.trunc(Number(auditRetentionDays))))
    : 180;

  const resetResult = run(
    `DELETE FROM password_reset_tokens
     WHERE used_at IS NOT NULL
        OR expires_at < datetime('now', '-1 day')`
  );

  const auditResult = run(
    `DELETE FROM audit_logs
     WHERE created_at < datetime('now', ?)`,
    [`-${days} days`]
  );

  return {
    passwordResetRows: Number(resetResult?.changes || 0),
    auditRows: Number(auditResult?.changes || 0),
    retentionDays: days
  };
}
