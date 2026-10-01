import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { backup } from 'node:sqlite';
import { db, databasePath } from '../src/config/db.js';

const rootDir = process.cwd();
const backupRoot = path.join(rootDir, 'backups');
const uploadsRoot = path.join(rootDir, 'storage', 'uploads');

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const destination = path.join(backupRoot, `dwm-full-${stamp}`);
const dbDestination = path.join(destination, 'data', 'dwm.sqlite');
const uploadsDestination = path.join(destination, 'storage', 'uploads');

fs.mkdirSync(path.dirname(dbDestination), { recursive: true });
fs.mkdirSync(uploadsDestination, { recursive: true });

await backup(db, dbDestination);

if (fs.existsSync(uploadsRoot)) {
  fs.cpSync(uploadsRoot, uploadsDestination, {
    recursive: true,
    force: false,
    errorOnExist: false
  });
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const result = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...walk(absolute));
    } else if (entry.isFile()) {
      result.push(absolute);
    }
  }

  return result;
}

function sha256(file) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(file));
  return hash.digest('hex');
}

const manifest = {
  app: process.env.APP_NAME || 'DWM',
  created_at: new Date().toISOString(),
  database_source: databasePath,
  files: walk(destination)
    .filter(file => path.basename(file) !== 'manifest.json')
    .map(file => ({
      path: path.relative(destination, file).split(path.sep).join('/'),
      bytes: fs.statSync(file).size,
      sha256: sha256(file)
    }))
};

fs.writeFileSync(
  path.join(destination, 'manifest.json'),
  JSON.stringify(manifest, null, 2) + '\n'
);

db.close();

console.log(`Full backup: ${destination}`);
console.log(`Files: ${manifest.files.length}`);
console.log('Secrets from .env are intentionally not included.');
