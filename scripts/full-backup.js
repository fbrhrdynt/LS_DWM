import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import archiver from 'archiver';
import { backup } from 'node:sqlite';
import { db, databasePath } from '../src/config/db.js';
import { buildManifest } from '../src/services/backup-utils.js';

const rootDir = process.cwd();
const backupRoot = path.join(rootDir, 'backups');
const uploadsRoot = path.join(rootDir, 'storage', 'uploads');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const destination = path.join(backupRoot, `dwm-full-${stamp}`);
const archivePath = `${destination}.zip`;
const dbDestination = path.join(destination, 'data', 'dwm.sqlite');
const uploadsDestination = path.join(destination, 'storage', 'uploads');

fs.mkdirSync(path.dirname(dbDestination), { recursive: true });
fs.mkdirSync(uploadsDestination, { recursive: true });
await backup(db, dbDestination);

if (fs.existsSync(uploadsRoot)) {
  fs.cpSync(uploadsRoot, uploadsDestination, { recursive: true, force: false, errorOnExist: false });
}

const manifest = buildManifest(destination, {
  app: process.env.APP_NAME || 'DWM',
  version: '0.8.0',
  created_at: new Date().toISOString(),
  database_source: databasePath,
  env_included: false
});
fs.writeFileSync(path.join(destination, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

db.close();

await new Promise((resolve, reject) => {
  const output = fs.createWriteStream(archivePath);
  const archive = archiver('zip', { zlib: { level: 6 } });
  output.on('close', resolve);
  archive.on('error', reject);
  archive.pipe(output);
  archive.directory(destination, path.basename(destination));
  archive.finalize();
});

console.log(`Full backup: ${destination}`);
console.log(`Archive: ${archivePath}`);
console.log(`Files: ${manifest.files.length}`);
console.log('Secrets from .env are intentionally not included.');
