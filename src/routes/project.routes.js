import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireProjectAccess } from '../middleware/access.js';
import { listProjects, projectReports } from '../controllers/project.controller.js';

const router = Router();

router.get('/projects', requireAuth, listProjects);
router.get('/projects/:projectId/reports', requireAuth, requireProjectAccess, projectReports);

export default router;
