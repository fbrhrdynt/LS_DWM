import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireGuest, requireAuth } from '../middleware/auth.js';
import { loginPage, login, logout } from '../controllers/auth.controller.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many login attempts. Please try again later.'
});

router.get('/login', requireGuest, loginPage);
router.post('/login', requireGuest, loginLimiter, login);
router.post('/logout', requireAuth, logout);

export default router;
