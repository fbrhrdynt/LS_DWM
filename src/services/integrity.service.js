import fs from 'node:fs';
import { all, get, run, transaction } from '../config/db.js';
import { fileExists } from './file-storage.js';
import { REPORT_CHILD_TABLES } from './relational-cleanup.service.js';

function issue(code, count, severity, message, rows = []) { return { code, count:Number(count||0), severity, message, rows }; }

export function databaseIntegrity() {
  const quick = all('PRAGMA integrity_check').map(row => Object.values(row)[0]);
  const foreign = all('PRAGMA foreign_key_check');
  return { sqliteOk: quick.length === 1 && quick[0] === 'ok', integrityRows: quick, foreignKeyRows: foreign };
}

export function domainIntegrityIssues() {
  const issues = [];

  for (const table of REPORT_CHILD_TABLES) {
    const orphans = all(`SELECT id_wellinfo FROM ${table} WHERE id_wellinfo NOT IN (SELECT id_wellinfo FROM wellinfo) LIMIT 20`);
    const count = get(`SELECT COUNT(*) AS total FROM ${table} WHERE id_wellinfo NOT IN (SELECT id_wellinfo FROM wellinfo)`)?.total || 0;
    if (count) issues.push(issue(`orphan_${table}`, count, 'error', `${table}: row(s) point to missing report`, orphans));

    const missing = all(`SELECT w.id_wellinfo, w.id_project FROM wellinfo w WHERE NOT EXISTS (SELECT 1 FROM ${table} c WHERE c.id_wellinfo = w.id_wellinfo) LIMIT 20`);
    const missingCount = get(`SELECT COUNT(*) AS total FROM wellinfo w WHERE NOT EXISTS (SELECT 1 FROM ${table} c WHERE c.id_wellinfo = w.id_wellinfo)`)?.total || 0;
    if (missingCount) issues.push(issue(`missing_${table}`, missingCount, 'warning', `report(s) missing ${table} row`, missing));
  }

  const checks = [
    ['users_project', `SELECT u.id_user, u.kode_login, u.id_project FROM xusers u LEFT JOIN projects p ON p.id_project=u.id_project WHERE u.id_project IS NOT NULL AND p.id_project IS NULL`, 'error', 'User assigned to missing project'],
    ['assets_project', `SELECT a.id, a.company_asset, a.id_project FROM assets_list a LEFT JOIN projects p ON p.id_project=a.id_project WHERE a.id_project IS NOT NULL AND p.id_project IS NULL`, 'error', 'Asset assigned to missing project'],
    ['assets_unassigned', `SELECT id, company_asset FROM assets_list WHERE id_project IS NULL`, 'warning', 'Asset is not assigned to a Project / Job'],
    ['assets_category', `SELECT a.id, a.company_asset, a.id_pm_category FROM assets_list a LEFT JOIN pm_categories c ON c.id=a.id_pm_category WHERE c.id IS NULL`, 'error', 'Asset compatibility category is missing'],
    ['duplicate_report_no', `SELECT id_project, CAST(urut AS INTEGER) report_no, COUNT(*) total FROM wellinfo GROUP BY id_project, CAST(urut AS INTEGER) HAVING COUNT(*) > 1`, 'warning', 'Duplicate report number in project']
  ];

  for (const [code, sql, severity, message] of checks) {
    const rows = all(sql);
    if (rows.length) issues.push(issue(code, rows.length, severity, message, rows.slice(0,20)));
  }

  const decimals = all(`SELECT id_wellinfo, id_project, urut FROM wellinfo WHERE instr(CAST(urut AS TEXT), '.') > 0 LIMIT 20`);
  const decimalCount = get(`SELECT COUNT(*) AS total FROM wellinfo WHERE instr(CAST(urut AS TEXT), '.') > 0`)?.total || 0;
  if (decimalCount) issues.push(issue('report_number_decimal', decimalCount, 'warning', 'Report number contains decimal notation', decimals));

  const fileRefs = [
    ...all(`SELECT 'client_logo' kind, id_project entity_id, logo file_path FROM projects WHERE logo IS NOT NULL AND trim(logo) <> ''`)
  ];
  const company = get(`SELECT value FROM app_settings WHERE key='company_logo' LIMIT 1`);
  if (company?.value) fileRefs.push({ kind:'company_logo', entity_id:0, file_path:company.value });
  const missingFiles = fileRefs.filter(row => !fileExists(row.file_path)).slice(0,100);
  if (missingFiles.length) issues.push(issue('missing_upload_files', missingFiles.length, 'warning', 'Database references logo file(s) that are missing', missingFiles.slice(0,20)));

  return issues;
}

export function integrityReport() {
  const db = databaseIntegrity();
  const issues = domainIntegrityIssues();
  return {
    ok: db.sqliteOk && db.foreignKeyRows.length === 0 && !issues.some(i => i.severity === 'error'),
    sqlite: db,
    issues,
    summary: {
      errors: issues.filter(i => i.severity === 'error').reduce((a,i)=>a+i.count,0),
      warnings: issues.filter(i => i.severity === 'warning').reduce((a,i)=>a+i.count,0),
      issueTypes: issues.length
    }
  };
}

export function repairSafeIntegrityIssues({ apply = false } = {}) {
  const actions = [];
  const reportIds = all('SELECT id_wellinfo FROM wellinfo ORDER BY id_wellinfo').map(r=>Number(r.id_wellinfo));
  for (const id of reportIds) {
    for (const table of REPORT_CHILD_TABLES) {
      const exists = get(`SELECT 1 ok FROM ${table} WHERE id_wellinfo=? LIMIT 1`, [id]);
      if (!exists) actions.push({ action:'create_missing_report_child', table, id_wellinfo:id });
    }
  }
  const decimalRows = all(`SELECT id_wellinfo, urut FROM wellinfo WHERE instr(CAST(urut AS TEXT), '.') > 0`);
  for (const row of decimalRows) actions.push({ action:'normalize_report_number', id_wellinfo:row.id_wellinfo, from:String(row.urut), to:String(Math.trunc(Number(row.urut)||0)) });

  if (apply && actions.length) {
    transaction(() => {
      for (const item of actions) {
        if (item.action === 'create_missing_report_child') {
          if (item.table === 'cuttingsbypassed') {
            run(`INSERT INTO cuttingsbypassed (id_wellinfo, percentage, volume, from_depth, each_from_depth, to_depth, each_to_depth, created_at, updated_at) VALUES (?,0,0,0,'Metre',0,'Metre',datetime('now'),datetime('now'))`, [item.id_wellinfo]);
          } else {
            run(`INSERT INTO ${item.table} (id_wellinfo) VALUES (?)`, [item.id_wellinfo]);
          }
        } else if (item.action === 'normalize_report_number') {
          run(`UPDATE wellinfo SET urut=?, updated_at=datetime('now') WHERE id_wellinfo=?`, [item.to, item.id_wellinfo]);
        }
      }
    });
  }
  return { apply, actions };
}
