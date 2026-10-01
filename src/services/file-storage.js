import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
export const uploadRoot = path.join(rootDir, 'storage', 'uploads');

const allowedDocumentExtensions = new Set(['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx']);
const allowedCertificateExtensions = new Set(['.pdf', '.doc', '.docx']);

fs.mkdirSync(uploadRoot, { recursive: true });

function sanitizeBaseName(name) {
  return String(name || 'file')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'file';
}

function uploadFactory(folder, { limitMb, extensions }) {
  const targetDir = path.join(uploadRoot, folder);
  fs.mkdirSync(targetDir, { recursive: true });

  return multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, targetDir),
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase();
        const stem = sanitizeBaseName(path.basename(file.originalname || 'file', ext));
        cb(null, `${Date.now()}-${crypto.randomUUID()}-${stem}${ext}`);
      }
    }),
    limits: { fileSize: limitMb * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      if (!extensions.has(ext)) {
        return cb(new Error(`Unsupported file type: ${ext || 'unknown'}`));
      }
      cb(null, true);
    }
  });
}

export const uploadCoc = uploadFactory('coc', { limitMb: 5, extensions: allowedCertificateExtensions });
export const uploadInspection = uploadFactory('inspection', { limitMb: 5, extensions: allowedCertificateExtensions });
export const uploadPmDocument = uploadFactory('pm-documents', { limitMb: 15, extensions: allowedDocumentExtensions });

export function relativeUploadPath(file) {
  if (!file?.path) return null;
  return path.relative(uploadRoot, file.path).split(path.sep).join('/');
}

export function resolveStoredUpload(relativePath) {
  if (!relativePath) return null;
  const normalized = String(relativePath).replaceAll('\\', '/').replace(/^\/+/, '');
  const absolute = path.resolve(uploadRoot, normalized);
  const root = path.resolve(uploadRoot) + path.sep;
  if (!absolute.startsWith(root)) return null;
  return absolute;
}

export function deleteStoredUpload(relativePath) {
  const absolute = resolveStoredUpload(relativePath);
  if (!absolute) return;
  try { fs.rmSync(absolute, { force: true }); } catch {}
}

export function fileExists(relativePath) {
  const absolute = resolveStoredUpload(relativePath);
  return Boolean(absolute && fs.existsSync(absolute));
}

export function removeUploadedRequestFile(req) {
  if (req?.file?.path) {
    try { fs.rmSync(req.file.path, { force: true }); } catch {}
  }
}
