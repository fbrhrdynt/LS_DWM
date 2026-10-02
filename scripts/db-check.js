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


  const columnChecks = {
    wellinfo: ['validation_status', 'created_by_user_id', 'submitted_at', 'validated_by_user_id', 'validated_at'],
    assets_list: ['id_project']
  };

  for (const [table, columns] of Object.entries(columnChecks)) {
    if (!tables.has(table)) continue;
    const existing = new Set(all(`PRAGMA table_info("${table}")`).map(row => row.name));
    for (const column of columns) {
      const ok = existing.has(column);
      console.log(`${ok ? 'OK  ' : 'MISS'} ${table}.${column}`);
      if (!ok) failed = true;
    }
  }

  process.exit(failed ? 1 : 0);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
