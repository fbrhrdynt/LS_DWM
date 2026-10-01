import 'dotenv/config';
import { db } from '../src/config/db.js';

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
  'inspection_detail'
];

try {
  const [rows] = await db.query('SHOW TABLES');
  const found = new Set(rows.map(row => Object.values(row)[0]));

  let failed = false;
  for (const table of requiredTables) {
    const ok = found.has(table);
    console.log(`${ok ? 'OK ' : 'MISS'} ${table}`);
    if (!ok) failed = true;
  }

  await db.end();
  process.exit(failed ? 1 : 0);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
