import { all, get, run, transaction } from '../config/db.js';

const PROJECT_MANAGERS = new Set(['MASTER', 'Supervisor']);

function todayLocal() {
  const timeZone = process.env.APP_TIMEZONE || 'Asia/Jakarta';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function clean(value, max = 255) {
  return String(value ?? '').trim().slice(0, max);
}

function canManageProjects(user) {
  return PROJECT_MANAGERS.has(user?.level);
}

function validateProjectInput(body) {
  const contract = clean(body.contract, 20);
  const operatorName = clean(body.operator_name);
  const drillingrig = clean(body.drillingrig);
  const wellname = clean(body.wellname);
  const accessCodeRaw = clean(body.kodeakses, 10);

  if (!contract) throw new Error('Contract is required.');
  if (!operatorName) throw new Error('Operator name is required.');
  if (!drillingrig) throw new Error('Drilling rig is required.');
  if (!wellname) throw new Error('Well name is required.');
  if (!/^\d{4,10}$/.test(accessCodeRaw)) {
    throw new Error('Access code must contain 4 to 10 digits.');
  }

  return {
    contract,
    operatorName,
    drillingrig,
    wellname,
    kodeakses: Number(accessCodeRaw)
  };
}

function accessibleProjects(user) {
  if (canManageProjects(user)) {
    return all(
      `SELECT id_project, contract, operator_name, drillingrig, wellname, logo
       FROM projects
       ORDER BY updated_at DESC, id_project DESC`
    );
  }

  return all(
    `SELECT id_project, contract, operator_name, drillingrig, wellname, logo
     FROM projects
     WHERE id_project = ?
     LIMIT 1`,
    [user.id_project]
  );
}

function renderProjectIndex(req, res, { error = null, values = {} } = {}) {
  res.render('projects/index', {
    title: 'Projects',
    projects: accessibleProjects(req.user),
    canManage: canManageProjects(req.user),
    error,
    values,
    notice: clean(req.query.notice, 300)
  });
}

function createInitialReport(projectId, input) {
  const date = todayLocal();

  const result = run(
    `INSERT INTO wellinfo
     (curdate, id_project, platform, wellname, spud_date, location, companyman, oim, mudeng, urut, lockreport, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, '', '', '', '', '1', 'NO', datetime('now'), datetime('now'))`,
    [date, projectId, input.contract, input.wellname, date]
  );

  const wellId = Number(result.lastInsertRowid);

  for (const table of ['details', 'retorts', 'desanders', 'desilters', 'dailywaste', 'additional', 'personnel']) {
    run(`INSERT INTO ${table} (id_wellinfo) VALUES (?)`, [wellId]);
  }

  run(
    `INSERT INTO cuttingsbypassed
     (id_wellinfo, percentage, volume, from_depth, each_from_depth, to_depth, each_to_depth, created_at, updated_at)
     VALUES (?, 0, 0, 0, 'Metre', 0, 'Metre', datetime('now'), datetime('now'))`,
    [wellId]
  );

  return wellId;
}

export function listProjects(req, res, next) {
  try {
    renderProjectIndex(req, res);
  } catch (error) {
    next(error);
  }
}

export function createProject(req, res, next) {
  try {
    const input = validateProjectInput(req.body);

    transaction(() => {
      const result = run(
        `INSERT INTO projects
         (contract, operator_name, drillingrig, logo, wellname, kodeakses, created_at, updated_at)
         VALUES (?, ?, ?, NULL, ?, ?, datetime('now'), datetime('now'))`,
        [input.contract, input.operatorName, input.drillingrig, input.wellname, input.kodeakses]
      );

      const projectId = Number(result.lastInsertRowid);
      createInitialReport(projectId, input);
    });

    res.redirect('/projects?notice=' + encodeURIComponent('Project and initial report created successfully.'));
  } catch (error) {
    if (error instanceof Error && !String(error.message).includes('SQLITE')) {
      return renderProjectIndex(req, res.status(422), {
        error: error.message,
        values: req.body
      });
    }
    next(error);
  }
}

export function editProjectPage(req, res, next) {
  try {
    const projectId = Number(req.params.projectId);
    const project = get(
      `SELECT id_project, contract, operator_name, drillingrig, wellname, logo, kodeakses
       FROM projects WHERE id_project = ? LIMIT 1`,
      [projectId]
    );

    if (!project) {
      return res.status(404).render('errors/404', { title: 'Project not found' });
    }

    res.render('projects/edit', {
      title: 'Edit project',
      project,
      error: null
    });
  } catch (error) {
    next(error);
  }
}

export function updateProject(req, res, next) {
  try {
    const projectId = Number(req.params.projectId);
    const existing = get('SELECT * FROM projects WHERE id_project = ? LIMIT 1', [projectId]);

    if (!existing) {
      return res.status(404).render('errors/404', { title: 'Project not found' });
    }

    const input = validateProjectInput(req.body);

    run(
      `UPDATE projects
       SET contract = ?, operator_name = ?, drillingrig = ?, wellname = ?, kodeakses = ?, updated_at = datetime('now')
       WHERE id_project = ?`,
      [input.contract, input.operatorName, input.drillingrig, input.wellname, input.kodeakses, projectId]
    );

    res.redirect('/projects?notice=' + encodeURIComponent('Project updated successfully.'));
  } catch (error) {
    if (error instanceof Error && !String(error.message).includes('SQLITE')) {
      return res.status(422).render('projects/edit', {
        title: 'Edit project',
        project: {
          id_project: Number(req.params.projectId),
          contract: req.body.contract,
          operator_name: req.body.operator_name,
          drillingrig: req.body.drillingrig,
          wellname: req.body.wellname,
          kodeakses: req.body.kodeakses,
          logo: null
        },
        error: error.message
      });
    }
    next(error);
  }
}

export function deleteProject(req, res, next) {
  try {
    const projectId = Number(req.params.projectId);
    const project = get(
      'SELECT id_project, operator_name FROM projects WHERE id_project = ? LIMIT 1',
      [projectId]
    );

    if (!project) {
      return res.status(404).render('errors/404', { title: 'Project not found' });
    }

    const assignedUsers = Number(get(
      `SELECT COUNT(*) AS total FROM xusers WHERE id_project = ?`,
      [projectId]
    )?.total ?? 0);

    if (assignedUsers > 0) {
      return res.redirect('/projects?notice=' + encodeURIComponent(
        'Project cannot be deleted while user accounts are assigned to it.'
      ));
    }

    run('DELETE FROM projects WHERE id_project = ?', [projectId]);
    res.redirect('/projects?notice=' + encodeURIComponent('Project deleted successfully.'));
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
       ORDER BY curdate DESC, CAST(urut AS INTEGER) DESC, id_wellinfo DESC`,
      [projectId]
    );

    res.render('projects/reports', {
      title: project.operator_name || 'Project reports',
      project,
      reports,
      notice: clean(req.query.notice, 300)
    });
  } catch (error) {
    next(error);
  }
}

export function reportDetail(req, res, next) {
  try {
    const projectId = Number(req.params.projectId);
    const wellId = Number(req.params.wellId);

    const project = get(
      `SELECT id_project, contract, operator_name, drillingrig, wellname, logo
       FROM projects WHERE id_project = ? LIMIT 1`,
      [projectId]
    );

    const report = get(
      `SELECT id_wellinfo, curdate, id_project, platform, wellname, spud_date, location,
              companyman, oim, mudeng, urut, lockreport, created_at, updated_at
       FROM wellinfo
       WHERE id_wellinfo = ? AND id_project = ?
       LIMIT 1`,
      [wellId, projectId]
    );

    if (!project || !report) {
      return res.status(404).render('errors/404', { title: 'Report not found' });
    }

    const details = get('SELECT * FROM details WHERE id_wellinfo = ? LIMIT 1', [wellId]) || {};
    const retort = get('SELECT * FROM retorts WHERE id_wellinfo = ? LIMIT 1', [wellId]) || {};
    const desander = get('SELECT * FROM desanders WHERE id_wellinfo = ? LIMIT 1', [wellId]) || {};
    const desilter = get('SELECT * FROM desilters WHERE id_wellinfo = ? LIMIT 1', [wellId]) || {};
    const bypassed = get('SELECT * FROM cuttingsbypassed WHERE id_wellinfo = ? LIMIT 1', [wellId]) || {};
    const dailyWaste = get('SELECT * FROM dailywaste WHERE id_wellinfo = ? LIMIT 1', [wellId]) || {};
    const personnel = get('SELECT * FROM personnel WHERE id_wellinfo = ? LIMIT 1', [wellId]) || {};
    const additional = get('SELECT * FROM additional WHERE id_wellinfo = ? LIMIT 1', [wellId]) || {};

    res.render('projects/report-detail', {
      title: `Report ${report.urut || report.id_wellinfo}`,
      project,
      report,
      details,
      retort,
      desander,
      desilter,
      bypassed,
      dailyWaste,
      personnel,
      additional,
      notice: clean(req.query.notice, 300)
    });
  } catch (error) {
    next(error);
  }
}
