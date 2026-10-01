import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/access.js';
import { verifyMultipartCsrf } from '../middleware/csrf.js';
import { uploadCompanyLogo, uploadProjectLogo } from '../services/file-storage.js';
import {
  reportSettingsPage,
  updateReportSettings,
  updateClientLogo,
  companyLogo
} from '../controllers/settings.controller.js';

const router = Router();
const masterOnly = [requireAuth, requireRole('MASTER')];

router.get('/settings/report', ...masterOnly, reportSettingsPage);
router.post(
  '/settings/report',
  ...masterOnly,
  uploadCompanyLogo.single('company_logo'),
  verifyMultipartCsrf,
  updateReportSettings
);
router.post(
  '/settings/report/client-logo',
  ...masterOnly,
  uploadProjectLogo.single('client_logo'),
  verifyMultipartCsrf,
  updateClientLogo
);
router.get('/settings/report/company-logo', requireAuth, companyLogo);

export default router;
