import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/access.js';
import {
  auditPage,
  securityPage,
  cleanupSecurityData
} from '../controllers/audit.controller.js';

const router = Router();
const masterOnly = [requireAuth, requireRole('MASTER')];

router.get('/settings/audit', ...masterOnly, auditPage);
router.get('/settings/security', ...masterOnly, securityPage);
router.post('/settings/security/cleanup', ...masterOnly, cleanupSecurityData);

export default router;
