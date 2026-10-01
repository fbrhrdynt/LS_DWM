import { all, get } from '../config/db.js';

export function loadDailyReport(projectId, wellId) {
  const project = get(
    `SELECT id_project, contract, operator_name, drillingrig, wellname, logo
     FROM projects
     WHERE id_project = ?
     LIMIT 1`,
    [projectId]
  );

  const report = get(
    `SELECT *
     FROM wellinfo
     WHERE id_wellinfo = ? AND id_project = ?
     LIMIT 1`,
    [wellId, projectId]
  );

  if (!project || !report) return null;

  return {
    project,
    report,
    details: get('SELECT * FROM details WHERE id_wellinfo = ? LIMIT 1', [wellId]) || {},
    retort: get('SELECT * FROM retorts WHERE id_wellinfo = ? LIMIT 1', [wellId]) || {},
    desander: get('SELECT * FROM desanders WHERE id_wellinfo = ? LIMIT 1', [wellId]) || {},
    desilter: get('SELECT * FROM desilters WHERE id_wellinfo = ? LIMIT 1', [wellId]) || {},
    bypassed: get('SELECT * FROM cuttingsbypassed WHERE id_wellinfo = ? LIMIT 1', [wellId]) || {},
    dailyWaste: get('SELECT * FROM dailywaste WHERE id_wellinfo = ? LIMIT 1', [wellId]) || {},
    personnel: get('SELECT * FROM personnel WHERE id_wellinfo = ? LIMIT 1', [wellId]) || {},
    additional: get('SELECT * FROM additional WHERE id_wellinfo = ? LIMIT 1', [wellId]) || {}
  };
}

export function loadProjectSummary(projectId) {
  const project = get(
    `SELECT id_project, contract, operator_name, drillingrig, wellname
     FROM projects
     WHERE id_project = ?
     LIMIT 1`,
    [projectId]
  );

  if (!project) return null;

  const rows = all(
    `SELECT
       w.*,
       d.*,
       r.*,
       pe.*,
       a.*,
       p.operator_name AS project_operator_name,
       p.drillingrig AS project_drillingrig,
       p.contract AS project_contract
     FROM wellinfo w
     JOIN projects p ON p.id_project = w.id_project
     LEFT JOIN details d ON d.id_wellinfo = w.id_wellinfo
     LEFT JOIN retorts r ON r.id_wellinfo = w.id_wellinfo
     LEFT JOIN personnel pe ON pe.id_wellinfo = w.id_wellinfo
     LEFT JOIN additional a ON a.id_wellinfo = w.id_wellinfo
     WHERE w.id_project = ?
     ORDER BY w.curdate ASC, CAST(w.urut AS INTEGER) ASC, w.id_wellinfo ASC`,
    [projectId]
  );

  return { project, rows };
}
