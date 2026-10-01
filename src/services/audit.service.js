import { all, run } from '../config/db.js';

function clean(value, max = 500) {
  return String(value ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);
}

export function recordAudit({
  userId = null,
  action,
  method = null,
  path = null,
  statusCode = null,
  ipAddress = null,
  userAgent = null,
  metadata = null
}) {
  try {
    const meta = metadata === null || metadata === undefined
      ? null
      : JSON.stringify(metadata).slice(0, 3000);

    run(
      `INSERT INTO audit_logs
       (user_id, action, method, path, status_code, ip_address, user_agent, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId ? Number(userId) : null,
        clean(action, 120) || 'unknown',
        method ? clean(method, 12) : null,
        path ? clean(path, 700) : null,
        Number.isInteger(Number(statusCode)) ? Number(statusCode) : null,
        ipAddress ? clean(ipAddress, 100) : null,
        userAgent ? clean(userAgent, 500) : null,
        meta
      ]
    );
  } catch (error) {
    console.error('Audit write failed:', error.message);
  }
}

export function listAuditLogs({ query = '', userId = null, limit = 200 } = {}) {
  const clauses = [];
  const params = [];

  if (query) {
    const like = `%${String(query).trim().slice(0, 100)}%`;
    clauses.push(`(
      a.action LIKE ?
      OR a.path LIKE ?
      OR COALESCE(u.employee_name, '') LIKE ?
      OR COALESCE(u.kode_login, '') LIKE ?
    )`);
    params.push(like, like, like, like);
  }

  if (userId && Number.isInteger(Number(userId))) {
    clauses.push('a.user_id = ?');
    params.push(Number(userId));
  }

  const safeLimit = Math.min(500, Math.max(1, Number(limit) || 200));
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  return all(
    `SELECT
       a.id,
       a.user_id,
       a.action,
       a.method,
       a.path,
       a.status_code,
       a.ip_address,
       a.user_agent,
       a.metadata,
       a.created_at,
       u.employee_name,
       u.kode_login
     FROM audit_logs a
     LEFT JOIN xusers u ON u.id_user = a.user_id
     ${where}
     ORDER BY a.id DESC
     LIMIT ${safeLimit}`,
    params
  );
}
