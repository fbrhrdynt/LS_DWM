import bcrypt from 'bcryptjs';
import { get, run } from '../config/db.js';
import { authenticate, verifyPassword } from '../services/auth.service.js';
import {
  bumpSessionVersion,
  consumeResetToken,
  createPasswordResetToken,
  findValidResetToken,
  getSessionVersion
} from '../services/security.service.js';
import { mailConfiguration, sendPasswordResetEmail } from '../services/mail.service.js';
import { recordAudit } from '../services/audit.service.js';

function clean(value, max = 300) {
  return String(value ?? '').trim().slice(0, max);
}

function requestContext(req) {
  return {
    method: req.method,
    path: req.originalUrl || req.path,
    ipAddress: req.ip || req.socket?.remoteAddress || null,
    userAgent: req.get('user-agent') || null
  };
}

function appBaseUrl(req) {
  const configured = clean(process.env.APP_URL, 500).replace(/\/+$/, '');
  if (configured) return configured;
  return `${req.protocol}://${req.get('host')}`;
}

function validateNewPassword(password, confirmation) {
  if (password.length < 8) return 'Password must contain at least 8 characters.';
  if (password !== confirmation) return 'Password confirmation does not match.';
  return null;
}

export function loginPage(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.render('auth/login', {
    title: 'Sign in',
    error: clean(req.query.error),
    notice: clean(req.query.notice),
    returnTo: req.query.returnTo || '/dashboard'
  });
}

export async function login(req, res, next) {
  try {
    const kodeLogin = clean(req.body.kode_login, 255);
    const password = String(req.body.pass_login || '');
    const returnTo = String(req.body.returnTo || '/dashboard');

    if (!kodeLogin || !password) {
      return res.status(422).render('auth/login', {
        title: 'Sign in',
        error: 'Username and password are required.',
        notice: '',
        returnTo
      });
    }

    const user = await authenticate(kodeLogin, password);
    if (!user) {
      recordAudit({
        action: 'auth.login_failed',
        ...requestContext(req),
        statusCode: 401,
        metadata: { username: kodeLogin }
      });

      return res.status(401).render('auth/login', {
        title: 'Sign in',
        error: 'Invalid credentials or inactive account.',
        notice: '',
        returnTo
      });
    }

    const sessionVersion = getSessionVersion(user.id_user);
    req.session = { userId: user.id_user, sessionVersion };

    recordAudit({
      userId: user.id_user,
      action: 'auth.login_success',
      ...requestContext(req),
      statusCode: 302
    });

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
  res.redirect('/login?notice=' + encodeURIComponent('You have been signed out.'));
}

export function forgotPasswordPage(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.render('auth/forgot-password', {
    title: 'Forgot password',
    error: clean(req.query.error),
    notice: clean(req.query.notice),
    devResetLink: null
  });
}

export async function requestPasswordReset(req, res, next) {
  try {
    const email = clean(req.body.email, 255).toLowerCase();
    const genericNotice = 'If the email is registered, a password reset link will be sent.';

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(422).render('auth/forgot-password', {
        title: 'Forgot password',
        error: 'Enter a valid email address.',
        notice: '',
        devResetLink: null
      });
    }

    const user = get(
      `SELECT id_user, employee_name, email, status
       FROM xusers
       WHERE lower(email) = ?
       LIMIT 1`,
      [email]
    );

    let devResetLink = null;

    if (user?.email) {
      const reset = createPasswordResetToken(user.id_user);
      const resetUrl = `${appBaseUrl(req)}/reset-password/${encodeURIComponent(reset.token)}`;

      let delivery = { sent: false, reason: 'unknown' };
      try {
        delivery = await sendPasswordResetEmail({
          to: user.email,
          name: user.employee_name,
          resetUrl,
          ttlMinutes: reset.ttlMinutes
        });
      } catch (mailError) {
        console.error('Password reset email failed:', mailError.message);
        delivery = { sent: false, reason: 'delivery-error' };
      }

      if (!delivery.sent && process.env.NODE_ENV !== 'production') {
        devResetLink = resetUrl;
      }

      recordAudit({
        userId: user.id_user,
        action: 'auth.password_reset_requested',
        ...requestContext(req),
        statusCode: 200,
        metadata: { delivery: delivery.sent ? 'email' : delivery.reason }
      });
    } else {
      recordAudit({
        action: 'auth.password_reset_requested_unknown_email',
        ...requestContext(req),
        statusCode: 200
      });
    }

    res.render('auth/forgot-password', {
      title: 'Forgot password',
      error: '',
      notice: genericNotice,
      devResetLink
    });
  } catch (error) {
    next(error);
  }
}

export function resetPasswordPage(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const token = clean(req.params.token, 200);
  const valid = token && findValidResetToken(token);

  if (!valid) {
    return res.redirect(
      '/forgot-password?error=' +
      encodeURIComponent('The reset link is invalid or has expired.')
    );
  }

  res.render('auth/reset-password', {
    title: 'Reset password',
    token,
    error: null,
    accountName: valid.employee_name
  });
}

export async function resetPassword(req, res, next) {
  try {
    const token = clean(req.body.token, 200);
    const password = String(req.body.pass_login || '');
    const confirmation = String(req.body.pass_login_confirmation || '');
    const validationError = validateNewPassword(password, confirmation);

    const valid = token && findValidResetToken(token);
    if (!valid) {
      return res.redirect(
        '/forgot-password?error=' +
        encodeURIComponent('The reset link is invalid or has expired.')
      );
    }

    if (validationError) {
      return res.status(422).render('auth/reset-password', {
        title: 'Reset password',
        token,
        error: validationError,
        accountName: valid.employee_name
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = consumeResetToken(token, passwordHash);

    if (!result) {
      return res.redirect(
        '/forgot-password?error=' +
        encodeURIComponent('The reset link is invalid or has expired.')
      );
    }

    recordAudit({
      userId: result.userId,
      action: 'auth.password_reset_completed',
      ...requestContext(req),
      statusCode: 302
    });

    req.session = null;

    res.redirect(
      '/login?notice=' +
      encodeURIComponent('Password updated. Sign in with your new password.')
    );
  } catch (error) {
    next(error);
  }
}

export function profilePage(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.render('auth/profile', {
    title: 'My account',
    error: clean(req.query.error),
    notice: clean(req.query.notice),
    mailConfigured: mailConfiguration().configured
  });
}

export async function changeOwnPassword(req, res, next) {
  try {
    const currentPassword = String(req.body.current_password || '');
    const newPassword = String(req.body.pass_login || '');
    const confirmation = String(req.body.pass_login_confirmation || '');
    const validationError = validateNewPassword(newPassword, confirmation);

    if (validationError) {
      return res.redirect('/profile?error=' + encodeURIComponent(validationError));
    }

    const account = get(
      `SELECT id_user, pass_login
       FROM xusers
       WHERE id_user = ? AND status = 'Y'
       LIMIT 1`,
      [req.user.id_user]
    );

    if (!account || !(await verifyPassword(currentPassword, account.pass_login))) {
      recordAudit({
        userId: req.user.id_user,
        action: 'auth.change_password_failed',
        ...requestContext(req),
        statusCode: 422
      });

      return res.redirect(
        '/profile?error=' + encodeURIComponent('Current password is incorrect.')
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    run('UPDATE xusers SET pass_login = ? WHERE id_user = ?', [passwordHash, req.user.id_user]);

    const nextVersion = bumpSessionVersion(req.user.id_user);
    req.session = {
      userId: req.user.id_user,
      sessionVersion: nextVersion
    };

    recordAudit({
      userId: req.user.id_user,
      action: 'auth.change_password_success',
      ...requestContext(req),
      statusCode: 302
    });

    res.redirect('/profile?notice=' + encodeURIComponent('Password changed successfully.'));
  } catch (error) {
    next(error);
  }
}
