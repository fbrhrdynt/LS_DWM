import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireAssetAccess, requireRole } from '../middleware/access.js';
import { assetsIndex, createAsset, assetDetail, updateAsset, deleteAsset, assetSelectApi } from '../controllers/asset.controller.js';

const router = Router();
const managers = [requireAuth, requireRole('MASTER', 'Supervisor')];
router.get('/assets', requireAuth, assetsIndex);
router.post('/assets', ...managers, createAsset);
router.get('/assets/:assetId', requireAuth, requireAssetAccess, assetDetail);
router.post('/assets/:assetId/update', ...managers, updateAsset);
router.post('/assets/:assetId/delete', ...managers, deleteAsset);
router.get('/api/assets', requireAuth, assetSelectApi);
router.get('/assets/select', requireAuth, assetSelectApi);
export default router;
