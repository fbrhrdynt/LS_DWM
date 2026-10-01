import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { backup } from 'node:sqlite';
import { db, databasePath } from '../src/config/db.js';

const backupDir = path.resolve(process.cwd(), 'backups');
fs.mkdirSync(backupDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const destination = path.join(backupDir, `dwm-${stamp}.sqlite`);

await backup(db, destination);
db.close();

console.log(`Database: ${databasePath}`);
console.log(`Backup:   ${destination}`);
