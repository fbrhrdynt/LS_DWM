import { get } from '../config/db.js';
import { todayInTimeZone } from '../services/maintenance-calculations.js';

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

    const today = todayInTimeZone();
    const inspectionDue = get(
      `SELECT COUNT(*) AS total FROM inspection_detail
       WHERE inspection_exp IS NOT NULL
         AND date(inspection_exp) <= date(?, '+30 day')`,
      [today]
    )?.total ?? 0;

    const pmDue = get(
      `SELECT COUNT(*) AS total FROM pm_details
       WHERE pm_due IS NOT NULL
         AND COALESCE(pm_status, '') NOT IN ('Completed','Cancelled')
         AND date(pm_due) <= date(?, '+30 day')`,
      [today]
    )?.total ?? 0;

    const users = globalAccess
      ? get(`SELECT COUNT(*) AS total FROM xusers WHERE status = 'Y'`)?.total ?? 0
      : get(`SELECT COUNT(*) AS total FROM xusers WHERE status = 'Y' AND id_project = ?`, [projectId])?.total ?? 0;

    res.render('dashboard/index', {
      title: 'Dashboard',
      stats: { projects, reports, assets, users, inspectionDue, pmDue }
    });
  } catch (error) {
    next(error);
  }
}
