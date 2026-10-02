import { all, get } from '../config/db.js';
import { isReportManager } from '../services/report-workflow.service.js';

export function dashboard(req, res, next) {
  try {
    const manager = isReportManager(req.user);
    const projectId = Number(req.user.id_project || 0);
    const params = manager ? [] : [projectId];
    const projects = manager
      ? Number(get('SELECT COUNT(*) AS total FROM projects')?.total || 0)
      : Number(get('SELECT COUNT(*) AS total FROM projects WHERE id_project = ?', [projectId])?.total || 0);
    const reports = Number(get(`SELECT COUNT(*) AS total FROM wellinfo ${manager ? '' : 'WHERE id_project = ?'}`, params)?.total || 0);
    const assets = Number(get(`SELECT COUNT(*) AS total FROM assets_list ${manager ? '' : 'WHERE id_project = ?'}`, params)?.total || 0);
    const pending = manager
      ? Number(get(`SELECT COUNT(*) AS total FROM wellinfo WHERE validation_status = 'PENDING'`)?.total || 0)
      : Number(get(`SELECT COUNT(*) AS total FROM wellinfo WHERE id_project = ? AND validation_status = 'PENDING'`, [projectId])?.total || 0);
    const validated = manager
      ? Number(get(`SELECT COUNT(*) AS total FROM wellinfo WHERE validation_status = 'VALIDATED'`)?.total || 0)
      : Number(get(`SELECT COUNT(*) AS total FROM wellinfo WHERE id_project = ? AND validation_status = 'VALIDATED'`, [projectId])?.total || 0);
    const recent = all(
      `SELECT w.id_wellinfo, w.id_project, w.urut, w.curdate, w.wellname, w.validation_status, p.operator_name
       FROM wellinfo w JOIN projects p ON p.id_project = w.id_project
       ${manager ? '' : 'WHERE w.id_project = ?'}
       ORDER BY w.curdate DESC, w.id_wellinfo DESC LIMIT 8`, params
    );
    res.render('dashboard/index', { title: 'Dashboard', stats: { projects, reports, assets, pending, validated }, recent, manager });
  } catch (error) { next(error); }
}
