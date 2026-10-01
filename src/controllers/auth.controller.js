import { authenticate } from '../services/auth.service.js';

export function loginPage(req, res) {
  res.render('auth/login', {
    title: 'Sign in',
    error: null,
    returnTo: req.query.returnTo || '/dashboard'
  });
}

export async function login(req, res, next) {
  try {
    const kodeLogin = String(req.body.kode_login || '').trim();
    const password = String(req.body.pass_login || '');
    const returnTo = String(req.body.returnTo || '/dashboard');

    if (!kodeLogin || !password) {
      return res.status(422).render('auth/login', {
        title: 'Sign in',
        error: 'Username and password are required.',
        returnTo
      });
    }

    const user = await authenticate(kodeLogin, password);
    if (!user) {
      return res.status(401).render('auth/login', {
        title: 'Sign in',
        error: 'Invalid credentials or inactive account.',
        returnTo
      });
    }

    // cookie-session is signed and intentionally stores only a tiny amount of data.
    // Rotate the session payload on successful login.
    req.session = { userId: user.id_user };

    const safeTarget = returnTo.startsWith('/') && !returnTo.startsWith('//')
      ? returnTo
      : '/dashboard';

    res.redirect(safeTarget);
  } catch (error) {
    next(error);
  }
}

export function logout(req, res) {
  req.session = null;
  res.redirect('/login');
}
