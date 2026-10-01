import { get } from '../config/db.js';

export function loadUser(req, res, next) {
  try {
    res.locals.user = null;
    req.user = null;

    const userId = req.session?.userId;
    if (!userId) return next();

    const user = get(
      `SELECT id_user, employee_id, employee_name, email, kode_login, level, id_project, status
       FROM xusers
       WHERE id_user = ? AND status = 'Y'
       LIMIT 1`,
      [userId]
    );

    if (!user) {
      req.session = null;
      return next();
    }

    req.user = user;
    res.locals.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireAuth(req, res, next) {
  if (!req.user) {
    const returnTo = encodeURIComponent(req.originalUrl || '/dashboard');
    return res.redirect(`/login?returnTo=${returnTo}`);
  }
  next();
}

export function requireGuest(req, res, next) {
  if (req.user) return res.redirect('/dashboard');
  next();
}
