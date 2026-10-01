import bcrypt from 'bcryptjs';
import { all, get, run } from '../config/db.js';

const LEVELS = new Set(['MASTER', 'Supervisor', 'Operator', 'Staff']);
const PROJECT_SCOPED_LEVELS = new Set(['Operator', 'Staff']);

function clean(value, max = 255) {
  return String(value ?? '').trim().slice(0, max);
}

function validEmail(value) {
  return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getProjects() {
  return all(
    `SELECT id_project, contract, operator_name, drillingrig
     FROM projects
     ORDER BY operator_name COLLATE NOCASE, drillingrig COLLATE NOCASE`
  );
}

function resolveProject(level, rawProjectId) {
  if (!PROJECT_SCOPED_LEVELS.has(level)) return null;

  const projectId = Number(rawProjectId);
  if (!Number.isInteger(projectId) || projectId < 1) {
    throw new Error('Operator and Staff must be assigned to a project.');
  }

  const exists = get(
    'SELECT id_project FROM projects WHERE id_project = ? LIMIT 1',
    [projectId]
  );

  if (!exists) throw new Error('Selected project was not found.');
  return projectId;
}

function validateAccountInput(body, { passwordRequired = false } = {}) {
  const employeeId = clean(body.employee_id, 20);
  const employeeName = clean(body.employee_name);
  const email = clean(body.email, 100);
  const kodeLogin = clean(body.kode_login);
  const level = clean(body.level, 20);
  const password = String(body.pass_login ?? '');

  if (!employeeId) throw new Error('Employee ID is required.');
  if (!employeeName) throw new Error('Employee name is required.');
  if (!kodeLogin) throw new Error('Username is required.');
  if (!LEVELS.has(level)) throw new Error('Invalid account level.');
  if (!validEmail(email)) throw new Error('Email address is invalid.');
  if (passwordRequired && password.length < 8) {
    throw new Error('Password must contain at least 8 characters.');
  }
  if (password && password.length < 8) {
    throw new Error('New password must contain at least 8 characters.');
  }

  return { employeeId, employeeName, email, kodeLogin, level, password };
}

function ensureUnique({ employeeId, kodeLogin, excludeId = null }) {
  const duplicateEmployee = excludeId
    ? get('SELECT id_user FROM xusers WHERE employee_id = ? AND id_user != ? LIMIT 1', [employeeId, excludeId])
    : get('SELECT id_user FROM xusers WHERE employee_id = ? LIMIT 1', [employeeId]);

  if (duplicateEmployee) throw new Error('Employee ID is already in use.');

  const duplicateLogin = excludeId
    ? get('SELECT id_user FROM xusers WHERE kode_login = ? AND id_user != ? LIMIT 1', [kodeLogin, excludeId])
    : get('SELECT id_user FROM xusers WHERE kode_login = ? LIMIT 1', [kodeLogin]);

  if (duplicateLogin) throw new Error('Username is already in use.');
}

function activeMasterCount() {
  return Number(get(
    `SELECT COUNT(*) AS total FROM xusers WHERE level = 'MASTER' AND status = 'Y'`
  )?.total ?? 0);
}

function listRows() {
  return all(
    `SELECT
       u.id_user,
       u.employee_id,
       u.employee_name,
       u.email,
       u.kode_login,
       u.level,
       u.id_project,
       u.status,
       p.operator_name,
       p.drillingrig
     FROM xusers u
     LEFT JOIN projects p ON p.id_project = u.id_project
     ORDER BY
       CASE u.level WHEN 'MASTER' THEN 0 WHEN 'Supervisor' THEN 1 ELSE 2 END,
       u.employee_name COLLATE NOCASE`
  );
}

export function accountsIndex(req, res, next) {
  try {
    res.render('accounts/index', {
      title: 'Accounts',
      accounts: listRows(),
      projects: getProjects(),
      error: null,
      values: {},
      notice: clean(req.query.notice, 300)
    });
  } catch (error) {
    next(error);
  }
}

export async function createAccount(req, res, next) {
  try {
    const values = req.body;
    const input = validateAccountInput(values, { passwordRequired: true });
    ensureUnique(input);
    const projectId = resolveProject(input.level, values.id_project);
    const passwordHash = await bcrypt.hash(input.password, 12);

    run(
      `INSERT INTO xusers
       (employee_id, employee_name, email, kode_login, pass_login, level, id_project, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Y')`,
      [
        input.employeeId,
        input.employeeName,
        input.email || null,
        input.kodeLogin,
        passwordHash,
        input.level,
        projectId
      ]
    );

    res.redirect('/accounts?notice=' + encodeURIComponent('Account created successfully.'));
  } catch (error) {
    if (error instanceof Error && !String(error.message).includes('SQLITE')) {
      return res.status(422).render('accounts/index', {
        title: 'Accounts',
        accounts: listRows(),
        projects: getProjects(),
        error: error.message,
        values: req.body,
        notice: ''
      });
    }
    next(error);
  }
}

export function editAccountPage(req, res, next) {
  try {
    const accountId = Number(req.params.accountId);
    const account = get(
      `SELECT id_user, employee_id, employee_name, email, kode_login, level, id_project, status
       FROM xusers WHERE id_user = ? LIMIT 1`,
      [accountId]
    );

    if (!account) {
      return res.status(404).render('errors/404', { title: 'Account not found' });
    }

    res.render('accounts/edit', {
      title: 'Edit account',
      account,
      projects: getProjects(),
      error: null
    });
  } catch (error) {
    next(error);
  }
}

export async function updateAccount(req, res, next) {
  try {
    const accountId = Number(req.params.accountId);
    const account = get(
      `SELECT id_user, employee_id, employee_name, email, kode_login, pass_login, level, id_project, status
       FROM xusers WHERE id_user = ? LIMIT 1`,
      [accountId]
    );

    if (!account) {
      return res.status(404).render('errors/404', { title: 'Account not found' });
    }

    const input = validateAccountInput(req.body);
    ensureUnique({ ...input, excludeId: accountId });
    const projectId = resolveProject(input.level, req.body.id_project);

    if (accountId === Number(req.user.id_user) && input.level !== 'MASTER') {
      throw new Error('You cannot remove your own MASTER access.');
    }

    if (
      account.level === 'MASTER' &&
      input.level !== 'MASTER' &&
      account.status === 'Y' &&
      activeMasterCount() <= 1
    ) {
      throw new Error('At least one active MASTER account must remain.');
    }

    let passwordHash = account.pass_login;
    if (input.password) {
      passwordHash = await bcrypt.hash(input.password, 12);
    }

    run(
      `UPDATE xusers
       SET employee_id = ?,
           employee_name = ?,
           email = ?,
           kode_login = ?,
           pass_login = ?,
           level = ?,
           id_project = ?
       WHERE id_user = ?`,
      [
        input.employeeId,
        input.employeeName,
        input.email || null,
        input.kodeLogin,
        passwordHash,
        input.level,
        projectId,
        accountId
      ]
    );

    res.redirect('/accounts?notice=' + encodeURIComponent('Account updated successfully.'));
  } catch (error) {
    if (error instanceof Error && !String(error.message).includes('SQLITE')) {
      const accountId = Number(req.params.accountId);
      return res.status(422).render('accounts/edit', {
        title: 'Edit account',
        account: {
          id_user: accountId,
          employee_id: req.body.employee_id,
          employee_name: req.body.employee_name,
          email: req.body.email,
          kode_login: req.body.kode_login,
          level: req.body.level,
          id_project: req.body.id_project,
          status: req.body.status || 'Y'
        },
        projects: getProjects(),
        error: error.message
      });
    }
    next(error);
  }
}

export function toggleAccountStatus(req, res, next) {
  try {
    const accountId = Number(req.params.accountId);
    const account = get(
      'SELECT id_user, employee_name, level, status FROM xusers WHERE id_user = ? LIMIT 1',
      [accountId]
    );

    if (!account) {
      return res.status(404).render('errors/404', { title: 'Account not found' });
    }

    if (accountId === Number(req.user.id_user)) {
      return res.redirect('/accounts?notice=' + encodeURIComponent('You cannot deactivate your own account.'));
    }

    if (account.level === 'MASTER' && account.status === 'Y' && activeMasterCount() <= 1) {
      return res.redirect('/accounts?notice=' + encodeURIComponent('The last active MASTER account cannot be deactivated.'));
    }

    const nextStatus = account.status === 'Y' ? 'N' : 'Y';
    run('UPDATE xusers SET status = ? WHERE id_user = ?', [nextStatus, accountId]);

    res.redirect('/accounts?notice=' + encodeURIComponent(
      `${account.employee_name} is now ${nextStatus === 'Y' ? 'active' : 'inactive'}.`
    ));
  } catch (error) {
    next(error);
  }
}

export function deleteAccount(req, res, next) {
  try {
    const accountId = Number(req.params.accountId);
    const account = get(
      'SELECT id_user, employee_name, level, status FROM xusers WHERE id_user = ? LIMIT 1',
      [accountId]
    );

    if (!account) {
      return res.status(404).render('errors/404', { title: 'Account not found' });
    }

    if (accountId === Number(req.user.id_user)) {
      return res.redirect('/accounts?notice=' + encodeURIComponent('You cannot delete your own account.'));
    }

    if (account.level === 'MASTER' && account.status === 'Y' && activeMasterCount() <= 1) {
      return res.redirect('/accounts?notice=' + encodeURIComponent('The last active MASTER account cannot be deleted.'));
    }

    const documents = Number(get(
      'SELECT COUNT(*) AS total FROM pm_data WHERE id_user = ?',
      [accountId]
    )?.total ?? 0);

    if (documents > 0) {
      return res.redirect('/accounts?notice=' + encodeURIComponent(
        'This account owns PM documents. Deactivate it instead of deleting it.'
      ));
    }

    run('DELETE FROM xusers WHERE id_user = ?', [accountId]);
    res.redirect('/accounts?notice=' + encodeURIComponent('Account deleted successfully.'));
  } catch (error) {
    next(error);
  }
}
