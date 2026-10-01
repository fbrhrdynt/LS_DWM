import { get } from '../config/db.js';

export function dashboard(req, res, next) {
  try {
    const globalAccess = ['MASTER', 'Supervisor'].includes(req.user.level);
    const projectId = Number(req.user.id_project || 0);

    const projects = globalAccess
      ? get('SELECT COUNT(*) AS total FROM projects')?.total ?? 0
      : get('SELECT COUNT(*) AS total FROM projects WHERE id_project = ?', [projectId])?.total ?? 0;

    const reports = globalAccess
      ? get('SELECT COUNT(*) AS total FROM wellinfo')?.total ?? 0
      : get('SELECT COUNT(*) AS total FROM wellinfo WHERE id_project = ?', [projectId])?.total ?? 0;

    const assets = get('SELECT COUNT(*) AS total FROM assets_list')?.total ?? 0;

    const users = globalAccess
      ? get(`SELECT COUNT(*) AS total FROM xusers WHERE status = 'Y'`)?.total ?? 0
      : get(`SELECT COUNT(*) AS total FROM xusers WHERE status = 'Y' AND id_project = ?`, [projectId])?.total ?? 0;

    res.render('dashboard/index', {
      title: 'Dashboard',
      stats: { projects, reports, assets, users }
    });
  } catch (error) {
    next(error);
  }
}
