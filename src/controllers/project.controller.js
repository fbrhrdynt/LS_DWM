import { all, get } from '../config/db.js';

export function listProjects(req, res, next) {
  try {
    const globalAccess = ['MASTER', 'Supervisor'].includes(req.user.level);

    const rows = globalAccess
      ? all(
          `SELECT id_project, contract, operator_name, drillingrig, wellname, logo
           FROM projects
           ORDER BY updated_at DESC, id_project DESC`
        )
      : all(
          `SELECT id_project, contract, operator_name, drillingrig, wellname, logo
           FROM projects
           WHERE id_project = ?
           LIMIT 1`,
          [req.user.id_project]
        );

    res.render('projects/index', {
      title: 'Projects',
      projects: rows
    });
  } catch (error) {
    next(error);
  }
}

export function projectReports(req, res, next) {
  try {
    const projectId = Number(req.params.projectId);

    const project = get(
      `SELECT id_project, contract, operator_name, drillingrig, wellname, logo
       FROM projects WHERE id_project = ? LIMIT 1`,
      [projectId]
    );

    if (!project) {
      return res.status(404).render('errors/404', { title: 'Project not found' });
    }

    const reports = all(
      `SELECT id_wellinfo, curdate, platform, wellname, spud_date, location, urut, lockreport
       FROM wellinfo
       WHERE id_project = ?
       ORDER BY curdate DESC, urut DESC, id_wellinfo DESC`,
      [projectId]
    );

    res.render('projects/reports', {
      title: project.operator_name || 'Project reports',
      project,
      reports
    });
  } catch (error) {
    next(error);
  }
}
