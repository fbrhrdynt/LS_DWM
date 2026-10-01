import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { verifyBackupDirectory } from '../src/services/backup-utils.js';

const args = process.argv.slice(2);
const targetArg = args.find(arg => !arg.startsWith('--'));
const apply = args.includes('--apply');
if (!targetArg) {
  console.error('Usage: npm run backup:restore -- /path/to/dwm-full-... [--apply]');
  process.exit(2);
}

const source = path.resolve(targetArg);
const verify = verifyBackupDirectory(source);
if (!verify.ok) {
  console.error('Restore refused because backup verification failed:');
  for (const error of verify.errors) console.error(`- ${error}`);
  process.exit(1);
}

const root = process.cwd();
const configured = process.env.SQLITE_PATH || 'data/dwm.sqlite';
const dbPath = path.isAbsolute(configured) ? configured : path.join(root, configured);
const uploadsPath = path.join(root, 'storage', 'uploads');
const wal = `${dbPath}-wal`;

console.log(`Source: ${source}`);
console.log(`Database target: ${dbPath}`);
console.log(`Uploads target: ${uploadsPath}`);
if (!apply) {
  console.log('DRY RUN only. Stop DWM and add --apply to restore.');
  process.exit(0);
}

if (fs.existsSync(wal) && fs.statSync(wal).size > 0) {
  console.error(`Restore refused: active/non-empty WAL detected at ${wal}. Stop DWM cleanly before restore.`);
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const safety = path.join(root, 'backups', `pre-restore-${stamp}`);
fs.mkdirSync(path.join(safety, 'data'), { recursive: true });
fs.mkdirSync(path.join(safety, 'storage'), { recursive: true });
if (fs.existsSync(dbPath)) fs.copyFileSync(dbPath, path.join(safety, 'data', 'dwm.sqlite'));
if (fs.existsSync(uploadsPath)) fs.cpSync(uploadsPath, path.join(safety, 'storage', 'uploads'), { recursive: true });

fs.mkdirSync(path.dirname(dbPath), { recursive: true });
fs.copyFileSync(path.join(source, 'data', 'dwm.sqlite'), dbPath);
fs.rmSync(uploadsPath, { recursive: true, force: true });
const sourceUploads = path.join(source, 'storage', 'uploads');
if (fs.existsSync(sourceUploads)) fs.cpSync(sourceUploads, uploadsPath, { recursive: true });
else fs.mkdirSync(uploadsPath, { recursive: true });

for (const sidecar of [`${dbPath}-wal`, `${dbPath}-shm`]) fs.rmSync(sidecar, { force: true });
console.log(`Restore complete. Safety copy: ${safety}`);
console.log('Start DWM and run: npm run integrity:check');
