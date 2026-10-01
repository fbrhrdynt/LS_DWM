import 'dotenv/config';
import { all, run, transaction, db } from '../src/config/db.js';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const allProjects = args.includes('--all');
const idArg = args.find(arg => /^\d+$/.test(arg));

if (!allProjects && !idArg) {
  console.error('Usage: npm run reports:renumber -- PROJECT_ID [--apply]');
  console.error('   or: npm run reports:renumber -- --all [--apply]');
  process.exit(2);
}

const projects = allProjects
  ? all('SELECT id_project, operator_name FROM projects ORDER BY id_project')
  : all('SELECT id_project, operator_name FROM projects WHERE id_project = ?', [Number(idArg)]);

if (!projects.length) {
  console.error('No matching project found.');
  process.exit(2);
}

const plan = [];
for (const project of projects) {
  const reports = all(
    `SELECT id_wellinfo, urut, curdate
     FROM wellinfo
     WHERE id_project = ?
     ORDER BY date(curdate) ASC, id_wellinfo ASC`,
    [project.id_project]
  );
  reports.forEach((report, index) => {
    const next = String(index + 1);
    if (String(report.urut ?? '') !== next) {
      plan.push({ projectId: project.id_project, wellId: report.id_wellinfo, date: report.curdate, from: String(report.urut ?? ''), to: next });
    }
  });
}

console.log(`${apply ? 'APPLY' : 'DRY RUN'} - ${plan.length} report number change(s)`);
for (const item of plan.slice(0, 300)) {
  console.log(`Project ${item.projectId} ReportID ${item.wellId} ${item.date || '-'}: ${item.from || '-'} -> ${item.to}`);
}

if (apply && plan.length) {
  transaction(() => {
    for (const item of plan) {
      run(`UPDATE wellinfo SET urut = ?, updated_at = datetime('now') WHERE id_wellinfo = ? AND id_project = ?`, [item.to, item.wellId, item.projectId]);
    }
  });
  console.log('Report renumber complete.');
} else if (!apply) {
  console.log('Run again with --apply only if this ordering is correct.');
}

db.close();
