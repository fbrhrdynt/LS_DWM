import fs from 'node:fs';
import path from 'node:path';

function cleanBase(value) { return String(value || '').trim().replace(/\/+$/, ''); }
function authHeader() {
  const raw = `${process.env.OWNCLOUD_USERNAME || ''}:${process.env.OWNCLOUD_PASSWORD || ''}`;
  return `Basic ${Buffer.from(raw).toString('base64')}`;
}

export function webDavConfig() {
  const baseUri = cleanBase(process.env.OWNCLOUD_BASE_URI);
  const username = String(process.env.OWNCLOUD_USERNAME || '').trim();
  const password = String(process.env.OWNCLOUD_PASSWORD || '');
  const backupPath = String(process.env.WEBDAV_BACKUP_PATH || 'DWM-Backups').trim().replace(/^\/+|\/+$/g, '');
  return { baseUri, username, password, backupPath, configured: Boolean(baseUri && username && password) };
}

function joinUrl(base, relative = '') {
  const encoded = String(relative || '').split('/').filter(Boolean).map(encodeURIComponent).join('/');
  return encoded ? `${base}/${encoded}` : base;
}

async function request(method, url, options = {}) {
  const response = await fetch(url, {
    method,
    headers: { Authorization: authHeader(), ...(options.headers || {}) },
    body: options.body,
    duplex: options.body ? 'half' : undefined,
    signal: AbortSignal.timeout(Number(process.env.WEBDAV_TIMEOUT_MS || 15000))
  });
  return response;
}

export async function testWebDav() {
  const config = webDavConfig();
  if (!config.configured) return { ok: false, configured: false, status: null, message: 'WebDAV is not configured.' };
  try {
    const response = await request('PROPFIND', config.baseUri, { headers: { Depth: '0' } });
    const ok = response.status === 207 || response.ok;
    return { ok, configured: true, status: response.status, message: ok ? 'WebDAV connection successful.' : `WebDAV returned HTTP ${response.status}.` };
  } catch (error) {
    return { ok: false, configured: true, status: null, message: error.message };
  }
}

export async function ensureRemoteBackupFolder() {
  const config = webDavConfig();
  if (!config.configured) throw new Error('WebDAV is not configured.');
  const url = joinUrl(config.baseUri, config.backupPath);
  const probe = await request('PROPFIND', url, { headers: { Depth: '0' } });
  if (probe.status === 207 || probe.ok) return url;
  if (probe.status !== 404) throw new Error(`Unable to check WebDAV backup folder: HTTP ${probe.status}`);
  const create = await request('MKCOL', url);
  if (![201, 204, 405].includes(create.status)) throw new Error(`Unable to create WebDAV backup folder: HTTP ${create.status}`);
  return url;
}

export async function uploadBackupToWebDav(filePath) {
  const absolute = path.resolve(filePath);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) throw new Error('Backup archive not found.');
  const folderUrl = await ensureRemoteBackupFolder();
  const target = joinUrl(folderUrl, path.basename(absolute));
  const response = await request('PUT', target, {
    headers: { 'Content-Type': 'application/zip', 'Content-Length': String(fs.statSync(absolute).size) },
    body: fs.createReadStream(absolute)
  });
  if (!response.ok) throw new Error(`WebDAV upload failed: HTTP ${response.status}`);
  return { url: target, status: response.status, bytes: fs.statSync(absolute).size };
}
