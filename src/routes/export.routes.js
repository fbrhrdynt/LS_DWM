import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireProjectAccess, requireReportOpenAccess, requireRole, requireWellBelongsToProject } from '../middleware/access.js';
import { dailyReportPdf, projectWellSummary } from '../controllers/export.controller.js';

const router = Router();

router.get(
  '/projects/:projectId/reports/:wellId/pdf',
  requireAuth,
  requireProjectAccess,
  requireWellBelongsToProject,
  requireReportOpenAccess,
  dailyReportPdf
);

router.get(
  '/projects/:projectId/summary.xlsx',
  requireAuth,
  requireRole('MASTER', 'Supervisor'),
  requireProjectAccess,
  projectWellSummary
);

export default router;
