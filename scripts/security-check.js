import 'dotenv/config';
import { all } from '../src/config/db.js';
import { hashResetToken } from '../src/services/security.service.js';

const required = ['password_reset_tokens', 'user_security', 'audit_logs'];
const tables = new Set(
  all(`SELECT name FROM sqlite_master WHERE type = 'table'`).map(row => row.name)
);

for (const name of required) {
  if (!tables.has(name)) {
    throw new Error(`Missing security table: ${name}`);
  }
}

const hash = hashResetToken('dwm-security-check');
if (!/^[a-f0-9]{64}$/.test(hash)) {
  throw new Error('Reset token hashing check failed.');
}

console.log('Security checks: OK');
