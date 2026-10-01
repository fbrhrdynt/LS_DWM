import path from 'node:path';
import { verifyBackupDirectory } from '../src/services/backup-utils.js';

const target = process.argv[2];
if (!target) {
  console.error('Usage: npm run backup:verify -- /path/to/dwm-full-...');
  process.exit(2);
}
const result = verifyBackupDirectory(path.resolve(target));
if (result.ok) {
  console.log(`Backup verify: OK (${result.manifest?.files?.length || 0} files)`);
  process.exit(0);
}
console.error('Backup verify: FAILED');
for (const error of result.errors) console.error(`- ${error}`);
process.exit(1);
