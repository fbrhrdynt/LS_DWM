import 'dotenv/config';
import { all, databasePath } from '../src/config/db.js';

const requiredTables = [
  'projects',
  'xusers',
  'wellinfo',
  'details',
  'additional',
  'retorts',
  'desanders',
  'desilters',
  'cuttingsbypassed',
  'dailywaste',
  'personnel',
  'assets_list',
  'pm_categories',
  'pm_data',
  'pm_details',
  'pm_detail_category',
  'inspection_category',
  'inspection_detail',
  'app_settings',
  'password_reset_tokens',
  'user_security',
  'audit_logs'
];

try {
  const tables = new Set(
    all(`SELECT name FROM sqlite_master WHERE type = 'table'`)
      .map(row => row.name)
  );

  let failed = false;

  console.log(`Database: ${databasePath}`);
  for (const table of requiredTables) {
    const ok = tables.has(table);
    console.log(`${ok ? 'OK  ' : 'MISS'} ${table}`);
    if (!ok) failed = true;
  }

  process.exit(failed ? 1 : 0);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
