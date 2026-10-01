import bcrypt from 'bcryptjs';
import { get } from '../config/db.js';

export function normalizeLaravelBcrypt(hash) {
  if (typeof hash !== 'string') return hash;
  return hash.startsWith('$2y$') ? `$2b$${hash.slice(4)}` : hash;
}

export async function verifyPassword(password, storedHash) {
  if (!storedHash) return false;
  return bcrypt.compare(String(password || ''), normalizeLaravelBcrypt(storedHash));
}

export async function authenticate(kodeLogin, password) {
  const user = get(
    `SELECT id_user, employee_id, employee_name, email, kode_login, pass_login, level, id_project, status
     FROM xusers
     WHERE kode_login = ? AND status = 'Y'
     LIMIT 1`,
    [kodeLogin]
  );

  if (!user) return null;

  const valid = await verifyPassword(password, user.pass_login);
  if (!valid) return null;

  delete user.pass_login;
  return user;
}
