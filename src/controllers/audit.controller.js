import { all } from '../config/db.js';
import { listAuditLogs } from '../services/audit.service.js';
import { mailConfiguration } from '../services/mail.service.js';
import { purgeExpiredSecurityData } from '../services/security.service.js';

function clean(value, max = 200) {
  return String(value ?? '').trim().slice(0, max);
}

export function auditPage(req, res, next) {
  try {
    const query = clean(req.query.q, 100);
    const userId = req.query.user_id ? Number(req.query.user_id) : null;

    res.render('settings/audit', {
      title: 'Audit trail',
      logs: listAuditLogs({ query, userId, limit: 300 }),
      users: all(
        `SELECT id_user, employee_name, kode_login
         FROM xusers
         ORDER BY employee_name COLLATE NOCASE`
      ),
      filters: { q: query, user_id: userId || '' }
    });
  } catch (error) {
    next(error);
  }
}

export function securityPage(req, res, next) {
  try {
    const mail = mailConfiguration();
    res.render('settings/security', {
      title: 'Security settings',
      mail,
      sessionHours: Number(process.env.SESSION_MAX_HOURS || 8),
      resetTtlMinutes: Number(process.env.PASSWORD_RESET_TTL_MINUTES || 15),
      auditRetentionDays: Number(process.env.AUDIT_RETENTION_DAYS || 180),
      notice: clean(req.query.notice, 300)
    });
  } catch (error) {
    next(error);
  }
}

export function cleanupSecurityData(req, res, next) {
  try {
    const retention = Number(process.env.AUDIT_RETENTION_DAYS || 180);
    const result = purgeExpiredSecurityData(retention);

    const message =
      `Security cleanup complete: ${result.passwordResetRows} reset token row(s), ` +
      `${result.auditRows} audit row(s) removed.`;

    res.redirect('/settings/security?notice=' + encodeURIComponent(message));
  } catch (error) {
    next(error);
  }
}
