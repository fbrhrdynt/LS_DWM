import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const removed = [];

for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
  if (!entry.isFile()) continue;
  if (/^DWM-v.+\.zip$/i.test(entry.name)) {
    fs.rmSync(path.join(root, entry.name), { force: true });
    removed.push(entry.name);
  }
}

for (const legacyDoc of [
  'DEPLOY_v0.6.2.md', 'DEPLOY_v0.7.md', 'DEPLOY_v0.8.md', 'DEPLOY_v0.8.4.md',
  'PATCH_NOTES_v0.8.4.md', 'PATCH_NOTES_v0.8.5.md', 'PATCH_NOTES_v0.8.6.md',
  'PATCH_NOTES_v0.8.6.1.md', 'PATCH_NOTES_v0.8.6.2.md', 'RELEASE_0.8.md'
]) {
  const target = path.join(root, legacyDoc);
  if (fs.existsSync(target)) {
    fs.rmSync(target, { force: true });
    removed.push(legacyDoc);
  }
}

if (!removed.length) {
  console.log('Release cleanup: nothing to remove.');
} else {
  console.log('Release cleanup removed:');
  for (const item of removed) console.log(`- ${item}`);
}
