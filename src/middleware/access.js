import { get } from '../config/db.js';

const GLOBAL_LEVELS = new Set(['MASTER', 'Supervisor']);

export function requireRole(...levels) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).render('errors/401', { title: 'Unauthorized' });
    if (!levels.includes(req.user.level)) {
      return res.status(403).render('errors/403', { title: 'Access denied' });
    }
    next();
  };
}

export function requireProjectAccess(req, res, next) {
  try {
    const projectId = Number(req.params.projectId || req.params.project_id);
    if (!Number.isInteger(projectId) || projectId < 1) {
      return res.status(400).render('errors/400', { title: 'Invalid project' });
    }

    if (GLOBAL_LEVELS.has(req.user.level)) return next();

    if (Number(req.user.id_project) !== projectId) {
      return res.status(403).render('errors/403', { title: 'Access denied' });
    }

    next();
  } catch (error) {
    next(error);
  }
}

export function requireWellBelongsToProject(req, res, next) {
  try {
    const projectId = Number(req.params.projectId || req.params.project_id);
    const wellId = Number(req.params.wellId || req.params.wellinfo_id);

    const well = get(
      `SELECT id_wellinfo, id_project
       FROM wellinfo
       WHERE id_wellinfo = ? AND id_project = ?
       LIMIT 1`,
      [wellId, projectId]
    );

    if (!well) {
      return res.status(404).render('errors/404', { title: 'Report not found' });
    }

    req.wellinfo = well;
    next();
  } catch (error) {
    next(error);
  }
}
