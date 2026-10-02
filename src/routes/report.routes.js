import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/auth.js';
import { requireProjectAccess, requireRole, requireWellBelongsToProject } from '../middleware/access.js';
import {
  reportEditor,
  saveReportSection,
  lockReport,
  unlockReport,
  copyReport,
  deleteReport,
  recalculateReport
} from '../controllers/report.controller.js';

const router = Router();

const unlockLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many unlock attempts. Please try again later.'
});

const reportAccess = [requireAuth, requireProjectAccess, requireWellBelongsToProject];

router.get(
  '/projects/:projectId/reports/:wellId/edit',
  ...reportAccess,
  reportEditor
);

router.post(
  '/projects/:projectId/reports/:wellId/sections/:section',
  ...reportAccess,
  saveReportSection
);

router.post(
  '/projects/:projectId/reports/:wellId/lock',
  ...reportAccess,
  lockReport
);

router.post(
  '/projects/:projectId/reports/:wellId/unlock',
  requireAuth,
  unlockLimiter,
  requireProjectAccess,
  requireWellBelongsToProject,
  unlockReport
);

router.post(
  '/projects/:projectId/reports/:wellId/copy',
  ...reportAccess,
  copyReport
);

router.post(
  '/projects/:projectId/reports/:wellId/recalculate',
  ...reportAccess,
  recalculateReport
);

router.post(
  '/projects/:projectId/reports/:wellId/delete',
  requireAuth,
  requireRole('MASTER', 'Supervisor'),
  requireProjectAccess,
  requireWellBelongsToProject,
  deleteReport
);

export default router;
