import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { notificationsPage } from '../controllers/notification.controller.js';

const router = Router();
router.get('/notifications', requireAuth, notificationsPage);
export default router;
