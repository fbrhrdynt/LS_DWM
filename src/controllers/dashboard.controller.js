import { db } from '../config/db.js';

export async function dashboard(req, res, next) {
  try {
    const globalAccess = ['MASTER', 'Supervisor'].includes(req.user.level);
    const projectId = Number(req.user.id_project || 0);

    const projectWhere = globalAccess ? '' : ' WHERE id_project = ?';
    const projectArgs = globalAccess ? [] : [projectId];

    const [[projectCountRows], [reportCountRows], [assetCountRows], [activeUsersRows]] =
      await Promise.all([
        db.execute(`SELECT COUNT(*) AS total FROM projects${projectWhere}`, projectArgs),
        globalAccess
          ? db.execute('SELECT COUNT(*) AS total FROM wellinfo')
          : db.execute('SELECT COUNT(*) AS total FROM wellinfo WHERE id_project = ?', [projectId]),
        db.execute('SELECT COUNT(*) AS total FROM assets_list'),
        globalAccess
          ? db.execute(`SELECT COUNT(*) AS total FROM xusers WHERE status = 'Y'`)
          : db.execute(`SELECT COUNT(*) AS total FROM xusers WHERE status = 'Y' AND id_project = ?`, [projectId])
      ]);

    res.render('dashboard/index', {
      title: 'Dashboard',
      stats: {
        projects: projectCountRows[0].total,
        reports: reportCountRows[0].total,
        assets: assetCountRows[0].total,
        users: activeUsersRows[0].total
      }
    });
  } catch (error) {
    next(error);
  }
}
