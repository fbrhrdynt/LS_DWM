import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireProjectAccess, requireWellBelongsToProject } from '../middleware/access.js';

const router = Router();

function reportEdit(section) {
  return (req, res) => res.redirect(`/projects/${req.params.projectId}/reports/${req.params.wellId}/edit?section=${section}`);
}

router.get('/projects/details/:projectId', requireAuth, requireProjectAccess, (req,res) => {
  res.redirect(`/projects/${req.params.projectId}/reports`);
});
router.get('/projects/details/:projectId/:wellId', requireAuth, requireProjectAccess, requireWellBelongsToProject, (req,res) => {
  res.redirect(`/projects/${req.params.projectId}/reports/${req.params.wellId}`);
});
router.get('/projects/details/:projectId/:wellId/edit-first', requireAuth, requireProjectAccess, requireWellBelongsToProject, reportEdit('report'));
router.get('/projects/details/:projectId/:wellId/edit-well', requireAuth, requireProjectAccess, requireWellBelongsToProject, reportEdit('well'));
router.get('/projects/details/:projectId/:wellId/edit-amp', requireAuth, requireProjectAccess, requireWellBelongsToProject, reportEdit('amp'));
router.get('/projects/details/:projectId/:wellId/shakers', requireAuth, requireProjectAccess, requireWellBelongsToProject, reportEdit('shakers'));
router.get('/projects/details/:projectId/:wellId/centrifuge-1', requireAuth, requireProjectAccess, requireWellBelongsToProject, reportEdit('centrifuge1'));
router.get('/projects/details/:projectId/:wellId/centrifuge-2', requireAuth, requireProjectAccess, requireWellBelongsToProject, reportEdit('centrifuge2'));
router.get('/projects/details/:projectId/:wellId/centrifuge-3', requireAuth, requireProjectAccess, requireWellBelongsToProject, reportEdit('centrifuge3'));
router.get('/projects/details/:projectId/:wellId/cdu-1', requireAuth, requireProjectAccess, requireWellBelongsToProject, reportEdit('cdu1'));
router.get('/projects/details/:projectId/:wellId/cdu-2', requireAuth, requireProjectAccess, requireWellBelongsToProject, reportEdit('cdu2'));
router.get('/projects/details/:projectId/:wellId/desanders', requireAuth, requireProjectAccess, requireWellBelongsToProject, reportEdit('desander'));
router.get('/projects/details/:projectId/:wellId/desilters', requireAuth, requireProjectAccess, requireWellBelongsToProject, reportEdit('desilter'));
router.get('/projects/details/:projectId/:wellId/retort', requireAuth, requireProjectAccess, requireWellBelongsToProject, reportEdit('retort'));
router.get('/projects/details/:projectId/:wellId/bypassed', requireAuth, requireProjectAccess, requireWellBelongsToProject, reportEdit('bypassed'));
router.get('/projects/details/:projectId/:wellId/daily-waste', requireAuth, requireProjectAccess, requireWellBelongsToProject, reportEdit('waste'));
router.get('/projects/details/:projectId/:wellId/personnel', requireAuth, requireProjectAccess, requireWellBelongsToProject, reportEdit('personnel'));
router.get('/wellinfo/download-summary/:projectId', requireAuth, requireProjectAccess, (req,res) => res.redirect(`/projects/${req.params.projectId}/summary.xlsx`));
router.get('/wellinfo', requireAuth, (_req,res) => res.redirect('/projects'));

export default router;
