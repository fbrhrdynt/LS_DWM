import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { uploadBackupToWebDav } from '../src/services/webdav.service.js';

const explicit = process.argv[2];
let file = explicit ? path.resolve(explicit) : null;
if (!file) {
  const dir = path.join(process.cwd(), 'backups');
  const candidates = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter(name => /^dwm-full-.*\.zip$/.test(name)).sort().reverse()
    : [];
  if (!candidates.length) {
    console.error('No full backup ZIP found. Run npm run backup:full first.');
    process.exit(2);
  }
  file = path.join(dir, candidates[0]);
}
const result = await uploadBackupToWebDav(file);
console.log(`WebDAV backup uploaded: ${path.basename(file)} (${result.bytes} bytes)`);
