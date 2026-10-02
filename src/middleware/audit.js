import { recordAudit } from '../services/audit.service.js';

function classify(method, path) {
  const p = String(path || '');

  if (p === '/logout') return 'auth.logout';
  if (p.startsWith('/accounts')) return `account.${method.toLowerCase()}`;
  if (/\/reports\/\d+\/copy$/.test(p)) return 'report.copy';
  if (p.includes('/reports/')) return `report.${method.toLowerCase()}`;
  if (p.startsWith('/projects')) return `project.${method.toLowerCase()}`;
  if (p.startsWith('/assets')) return `asset.${method.toLowerCase()}`;
  if (p.startsWith('/settings')) return `settings.${method.toLowerCase()}`;
  if (p.startsWith('/profile')) return `profile.${method.toLowerCase()}`;

  return `http.${method.toLowerCase()}`;
}

export function auditMutations(req, res, next) {
  const method = String(req.method || '').toUpperCase();
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return next();

  if (
    req.path === '/login' ||
    req.path === '/forgot-password' ||
    req.path.startsWith('/reset-password')
  ) {
    return next();
  }

  const actorId = req.user?.id_user || null;
  const action = classify(method, req.path);
  const ipAddress = req.ip || req.socket?.remoteAddress || null;
  const userAgent = req.get('user-agent') || null;
  const path = req.originalUrl || req.path;

  res.on('finish', () => {
    recordAudit({
      userId: actorId,
      action,
      method,
      path,
      statusCode: res.statusCode,
      ipAddress,
      userAgent
    });
  });

  next();
}
