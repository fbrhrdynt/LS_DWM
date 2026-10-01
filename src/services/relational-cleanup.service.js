import { all, run, transaction } from '../config/db.js';

export const REPORT_CHILD_TABLES = Object.freeze([
  'details',
  'retorts',
  'desanders',
  'desilters',
  'cuttingsbypassed',
  'dailywaste',
  'additional',
  'personnel'
]);

export function deleteReportTree(wellId, projectId = null) {
  const id = Number(wellId);
  if (!Number.isInteger(id) || id < 1) return false;

  return transaction(() => {
    for (const table of REPORT_CHILD_TABLES) {
      run(`DELETE FROM ${table} WHERE id_wellinfo = ?`, [id]);
    }

    const result = projectId
      ? run('DELETE FROM wellinfo WHERE id_wellinfo = ? AND id_project = ?', [id, Number(projectId)])
      : run('DELETE FROM wellinfo WHERE id_wellinfo = ?', [id]);

    return Number(result?.changes || 0) > 0;
  });
}

export function deleteProjectTree(projectId) {
  const id = Number(projectId);
  if (!Number.isInteger(id) || id < 1) return false;

  return transaction(() => {
    const wells = all('SELECT id_wellinfo FROM wellinfo WHERE id_project = ?', [id]);
    for (const row of wells) {
      for (const table of REPORT_CHILD_TABLES) {
        run(`DELETE FROM ${table} WHERE id_wellinfo = ?`, [row.id_wellinfo]);
      }
    }
    run('DELETE FROM wellinfo WHERE id_project = ?', [id]);
    const result = run('DELETE FROM projects WHERE id_project = ?', [id]);
    return Number(result?.changes || 0) > 0;
  });
}
