import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const retired = [
  'src/routes/asset-maintenance.routes.js',
  'src/controllers/inspection.controller.js',
  'src/controllers/maintenance.controller.js',
  'src/controllers/notification.controller.js',
  'src/routes/notification.routes.js',
  'src/middleware/notifications.js',
  'src/services/notification.service.js',
  'src/services/maintenance-calculations.js',
  'views/inspection',
  'views/maintenance',
  'views/notifications',
  'views/reports/unlock-error.ejs',
  'public/js/maintenance.js',
  'scripts/maintenance-check.js'
];

const removed = [];
for (const rel of retired) {
  const target = path.join(root, rel);
  if (!fs.existsSync(target)) continue;
  fs.rmSync(target, { recursive: true, force: true });
  removed.push(rel);
}

console.log(removed.length
  ? `v0.9 cleanup removed ${removed.length} retired source item(s):\n- ${removed.join('\n- ')}`
  : 'v0.9 cleanup: retired source is already clean.');
console.log('Legacy Maintenance/Inspection database tables are intentionally preserved; only application features/routes are retired.');
