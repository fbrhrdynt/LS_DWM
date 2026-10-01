import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export function walkFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...walkFiles(absolute));
    else if (entry.isFile()) result.push(absolute);
  }
  return result;
}

export function sha256File(file) {
  const hash = crypto.createHash('sha256');
  const data = fs.readFileSync(file);
  hash.update(data);
  return hash.digest('hex');
}

export function buildManifest(root, metadata = {}) {
  return {
    schema: 1,
    ...metadata,
    files: walkFiles(root)
      .filter(file => path.basename(file) !== 'manifest.json')
      .map(file => ({
        path: path.relative(root, file).split(path.sep).join('/'),
        bytes: fs.statSync(file).size,
        sha256: sha256File(file)
      }))
  };
}

export function verifyBackupDirectory(root) {
  const manifestPath = path.join(root, 'manifest.json');
  const errors = [];
  if (!fs.existsSync(manifestPath)) return { ok: false, errors: ['manifest.json not found'], manifest: null };

  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); }
  catch { return { ok: false, errors: ['manifest.json is invalid JSON'], manifest: null }; }

  if (!Array.isArray(manifest.files)) errors.push('manifest.files is missing');
  for (const item of manifest.files || []) {
    const absolute = path.resolve(root, item.path);
    const prefix = path.resolve(root) + path.sep;
    if (!absolute.startsWith(prefix)) { errors.push(`Unsafe manifest path: ${item.path}`); continue; }
    if (!fs.existsSync(absolute)) { errors.push(`Missing: ${item.path}`); continue; }
    const stat = fs.statSync(absolute);
    if (Number(item.bytes) !== stat.size) errors.push(`Size mismatch: ${item.path}`);
    if (String(item.sha256) !== sha256File(absolute)) errors.push(`SHA-256 mismatch: ${item.path}`);
  }

  if (!fs.existsSync(path.join(root, 'data', 'dwm.sqlite'))) errors.push('data/dwm.sqlite not found');
  return { ok: errors.length === 0, errors, manifest };
}
