import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/access.js';
import { verifyMultipartCsrf } from '../middleware/csrf.js';
import { uploadCoc, uploadInspection, uploadPmDocument } from '../services/file-storage.js';
import {
  assetsIndex,
  createAsset,
  assetDetail,
  updateAsset,
  deleteAsset,
  downloadCoc,
  assetSelectApi
} from '../controllers/asset.controller.js';
import {
  inspectionIndex,
  createInspectionCategory,
  updateInspectionCategory,
  deleteInspectionCategory,
  saveAssetInspection,
  deleteInspection,
  downloadInspectionCertificate
} from '../controllers/inspection.controller.js';
import {
  maintenanceIndex,
  documentsIndex,
  createMaintenanceCategory,
  updateMaintenanceCategory,
  deleteMaintenanceCategory,
  saveMaintenanceRecord,
  updateMaintenanceRecord,
  deleteMaintenanceRecord,
  createDocumentCategory,
  updateDocumentCategory,
  deleteDocumentCategory,
  uploadDocument,
  downloadDocument,
  deleteDocument,
  maintenanceCategoryApi
} from '../controllers/maintenance.controller.js';

const router = Router();
const managers = [requireAuth, requireRole('MASTER', 'Supervisor')];

router.get('/assets', requireAuth, assetsIndex);
router.post('/assets', ...managers, uploadCoc.single('coc'), verifyMultipartCsrf, createAsset);
router.get('/assets/:assetId', requireAuth, assetDetail);
router.post('/assets/:assetId/update', ...managers, uploadCoc.single('coc'), verifyMultipartCsrf, updateAsset);
router.post('/assets/:assetId/delete', ...managers, deleteAsset);
router.get('/assets/:assetId/coc', requireAuth, downloadCoc);
router.get('/api/assets', requireAuth, assetSelectApi);
router.get('/assets/select', requireAuth, assetSelectApi);

router.get('/inspection', requireAuth, inspectionIndex);
router.post('/inspection/categories', ...managers, createInspectionCategory);
router.post('/inspection/categories/:categoryId/update', ...managers, updateInspectionCategory);
router.post('/inspection/categories/:categoryId/delete', ...managers, deleteInspectionCategory);
router.post('/assets/:assetId/inspections', ...managers, uploadInspection.single('cert'), verifyMultipartCsrf, saveAssetInspection);
router.post('/inspections/:inspectionId/delete', ...managers, deleteInspection);
router.get('/inspections/:inspectionId/certificate', requireAuth, downloadInspectionCertificate);

router.get('/maintenance', requireAuth, maintenanceIndex);
router.post('/maintenance/categories', ...managers, createMaintenanceCategory);
router.post('/maintenance/categories/:categoryId/update', ...managers, updateMaintenanceCategory);
router.post('/maintenance/categories/:categoryId/delete', ...managers, deleteMaintenanceCategory);
router.post('/assets/:assetId/maintenance', ...managers, saveMaintenanceRecord);
router.post('/maintenance/records/:recordId/update', ...managers, updateMaintenanceRecord);
router.post('/maintenance/records/:recordId/delete', ...managers, deleteMaintenanceRecord);
router.get('/api/maintenance/categories', requireAuth, maintenanceCategoryApi);
router.get('/pm-detail-categories/select', requireAuth, maintenanceCategoryApi);

router.get('/maintenance/documents', requireAuth, documentsIndex);
router.post('/maintenance/document-categories', ...managers, createDocumentCategory);
router.post('/maintenance/document-categories/:categoryId/update', ...managers, updateDocumentCategory);
router.post('/maintenance/document-categories/:categoryId/delete', ...managers, deleteDocumentCategory);
router.post('/maintenance/documents/:categoryId', ...managers, uploadPmDocument.single('file'), verifyMultipartCsrf, uploadDocument);
router.get('/maintenance/documents/:documentId/download', requireAuth, downloadDocument);
router.post('/maintenance/documents/:documentId/delete', ...managers, deleteDocument);

// Compatibility redirects for legacy bookmarks.
router.get('/inspection-data', requireAuth, (_req, res) => res.redirect('/inspection'));
router.get('/preventive-data', requireAuth, (_req, res) => res.redirect('/maintenance'));
router.get('/preventive-maintenance', requireAuth, (_req, res) => res.redirect('/maintenance'));
router.get('/preventive-category', requireAuth, (_req, res) => res.redirect('/maintenance'));
router.get('/pm-admin', requireAuth, (_req, res) => res.redirect('/maintenance/documents'));
router.get('/assets-category', requireAuth, (_req, res) => res.redirect('/maintenance/documents'));

export default router;
