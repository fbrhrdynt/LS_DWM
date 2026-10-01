import bcrypt from 'bcryptjs';
import { get } from '../config/db.js';

function normalizeLaravelBcrypt(hash) {
  if (typeof hash !== 'string') return hash;
  return hash.startsWith('$2y$') ? `$2b$${hash.slice(4)}` : hash;
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

  const hash = normalizeLaravelBcrypt(user.pass_login);
  const valid = await bcrypt.compare(password, hash);
  if (!valid) return null;

  delete user.pass_login;
  return user;
}
