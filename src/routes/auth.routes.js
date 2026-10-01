import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireGuest, requireAuth } from '../middleware/auth.js';
import {
  loginPage,
  login,
  logout,
  forgotPasswordPage,
  requestPasswordReset,
  resetPasswordPage,
  resetPassword,
  profilePage,
  changeOwnPassword
} from '../controllers/auth.controller.js';

const router = Router();

function renderRateLimited(view, title, message) {
  return (req, res) => res.status(429).render(view, {
    title,
    error: message,
    notice: '',
    returnTo: req.body?.returnTo || '/dashboard',
    devResetLink: null,
    token: req.body?.token || req.params?.token || '',
    accountName: ''
  });
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: renderRateLimited(
    'auth/login',
    'Sign in',
    'Too many login attempts. Try again in 15 minutes.'
  )
});

const resetRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: renderRateLimited(
    'auth/forgot-password',
    'Forgot password',
    'Too many reset requests. Try again later.'
  )
});


const changePasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.redirect(
    '/profile?error=' + encodeURIComponent('Too many password attempts. Try again later.')
  )
});

const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: renderRateLimited(
    'auth/reset-password',
    'Reset password',
    'Too many attempts. Request a new reset link.'
  )
});

router.get('/login', requireGuest, loginPage);
router.post('/login', requireGuest, loginLimiter, login);

router.get('/forgot-password', requireGuest, forgotPasswordPage);
router.post('/forgot-password', requireGuest, resetRequestLimiter, requestPasswordReset);

router.get('/reset-password/:token', requireGuest, resetPasswordPage);
router.post('/reset-password', requireGuest, resetLimiter, resetPassword);

router.get('/profile', requireAuth, profilePage);
router.post('/profile/password', requireAuth, changePasswordLimiter, changeOwnPassword);

router.post('/logout', requireAuth, logout);

export default router;
