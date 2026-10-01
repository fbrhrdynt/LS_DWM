import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/access.js';
import {
  accountsIndex,
  createAccount,
  editAccountPage,
  updateAccount,
  toggleAccountStatus,
  deleteAccount
} from '../controllers/account.controller.js';

const router = Router();
const masterOnly = [requireAuth, requireRole('MASTER')];

router.get('/accounts', ...masterOnly, accountsIndex);
router.post('/accounts', ...masterOnly, createAccount);
router.get('/accounts/:accountId/edit', ...masterOnly, editAccountPage);
router.post('/accounts/:accountId/update', ...masterOnly, updateAccount);
router.post('/accounts/:accountId/status', ...masterOnly, toggleAccountStatus);
router.post('/accounts/:accountId/delete', ...masterOnly, deleteAccount);

export default router;
