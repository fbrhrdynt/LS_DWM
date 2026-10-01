import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';

const root = path.join(process.cwd(), 'backups');
const days = Math.min(3650, Math.max(1, Number(process.env.BACKUP_RETENTION_DAYS || 14)));
const cutoff = Date.now() - days * 86400000;
if (!fs.existsSync(root)) { console.log('No backup directory.'); process.exit(0); }
let removed = 0;
for (const name of fs.readdirSync(root)) {
  if (!/^dwm-full-/.test(name)) continue;
  const target = path.join(root, name);
  const stat = fs.statSync(target);
  if (stat.mtimeMs < cutoff) {
    fs.rmSync(target, { recursive: true, force: true });
    removed++;
    console.log(`Removed ${name}`);
  }
}
console.log(`Backup prune complete: ${removed} item(s), retention ${days} day(s).`);
