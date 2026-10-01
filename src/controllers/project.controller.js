import { db } from '../config/db.js';

export async function listProjects(req, res, next) {
  try {
    const globalAccess = ['MASTER', 'Supervisor'].includes(req.user.level);

    let rows;
    if (globalAccess) {
      [rows] = await db.execute(
        `SELECT id_project, contract, operator_name, drillingrig, wellname, logo
         FROM projects
         ORDER BY updated_at DESC, id_project DESC`
      );
    } else {
      [rows] = await db.execute(
        `SELECT id_project, contract, operator_name, drillingrig, wellname, logo
         FROM projects
         WHERE id_project = ?
         LIMIT 1`,
        [req.user.id_project]
      );
    }

    res.render('projects/index', {
      title: 'Projects',
      projects: rows
    });
  } catch (error) {
    next(error);
  }
}

export async function projectReports(req, res, next) {
  try {
    const projectId = Number(req.params.projectId);

    const [[projects], [reports]] = await Promise.all([
      db.execute(
        `SELECT id_project, contract, operator_name, drillingrig, wellname, logo
         FROM projects WHERE id_project = ? LIMIT 1`,
        [projectId]
      ),
      db.execute(
        `SELECT id_wellinfo, curdate, platform, wellname, spud_date, location, urut, lockreport
         FROM wellinfo
         WHERE id_project = ?
         ORDER BY curdate DESC, urut DESC, id_wellinfo DESC`,
        [projectId]
      )
    ]);

    if (!projects[0]) {
      return res.status(404).render('errors/404', { title: 'Project not found' });
    }

    res.render('projects/reports', {
      title: projects[0].operator_name || 'Project reports',
      project: projects[0],
      reports
    });
  } catch (error) {
    next(error);
  }
}
