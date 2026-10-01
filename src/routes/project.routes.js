import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireProjectAccess, requireRole, requireWellBelongsToProject } from '../middleware/access.js';
import {
  listProjects,
  createProject,
  editProjectPage,
  updateProject,
  deleteProject,
  projectReports,
  reportDetail
} from '../controllers/project.controller.js';

const router = Router();
const projectManagers = [requireAuth, requireRole('MASTER', 'Supervisor')];

router.get('/projects', requireAuth, listProjects);
router.post('/projects', ...projectManagers, createProject);
router.get('/projects/:projectId/edit', ...projectManagers, editProjectPage);
router.post('/projects/:projectId/update', ...projectManagers, updateProject);
router.post('/projects/:projectId/delete', ...projectManagers, deleteProject);

router.get('/projects/:projectId/reports', requireAuth, requireProjectAccess, projectReports);
router.get(
  '/projects/:projectId/reports/:wellId',
  requireAuth,
  requireProjectAccess,
  requireWellBelongsToProject,
  reportDetail
);

export default router;
