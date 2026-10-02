import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  requireProjectAccess,
  requireReportEditAccess,
  requireReportOpenAccess,
  requireRole,
  requireWellBelongsToProject
} from '../middleware/access.js';
import {
  reportEditor,
  saveReportSection,
  copyReport,
  createNextReport,
  validateReportAction,
  reopenReportAction,
  deleteReport,
  recalculateReport
} from '../controllers/report.controller.js';

const router = Router();
const reportViewAccess = [requireAuth, requireProjectAccess, requireWellBelongsToProject, requireReportOpenAccess];
const reportEditAccess = [requireAuth, requireProjectAccess, requireWellBelongsToProject, requireReportEditAccess];
const managerReportAccess = [requireAuth, requireRole('MASTER', 'Supervisor'), requireProjectAccess, requireWellBelongsToProject];

router.post('/projects/:projectId/reports/new', requireAuth, requireProjectAccess, createNextReport);
router.get('/projects/:projectId/reports/:wellId/edit', ...reportEditAccess, reportEditor);
router.post('/projects/:projectId/reports/:wellId/sections/:section', ...reportEditAccess, saveReportSection);
router.post('/projects/:projectId/reports/:wellId/copy', ...reportViewAccess, copyReport);
router.post('/projects/:projectId/reports/:wellId/recalculate', ...reportEditAccess, recalculateReport);
router.post('/projects/:projectId/reports/:wellId/validate', ...managerReportAccess, validateReportAction);
router.post('/projects/:projectId/reports/:wellId/reopen', ...managerReportAccess, reopenReportAction);
router.post('/projects/:projectId/reports/:wellId/delete', ...managerReportAccess, deleteReport);

export default router;
