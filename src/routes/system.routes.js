import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/access.js';
import { systemPage, repairIntegrity, webdavTest } from '../controllers/system.controller.js';
const router=Router(); const master=[requireAuth,requireRole('MASTER')];
router.get('/settings/system',...master,systemPage);
router.post('/settings/system/repair',...master,repairIntegrity);
router.post('/settings/system/webdav-test',...master,webdavTest);
export default router;
