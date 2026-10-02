import { get } from '../config/db.js';
import { isReportManager, operatorCanEditReport, operatorCanOpenReport } from '../services/report-workflow.service.js';

const GLOBAL_LEVELS = new Set(['MASTER', 'Supervisor']);

export function requireRole(...levels) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).render('errors/401', { title: 'Unauthorized' });
    if (!levels.includes(req.user.level)) {
      return res.status(403).render('errors/403', { title: 'Access denied' });
    }
    next();
  };
}

export function requireProjectAccess(req, res, next) {
  try {
    const projectId = Number(req.params.projectId || req.params.project_id);
    if (!Number.isInteger(projectId) || projectId < 1) {
      return res.status(400).render('errors/400', { title: 'Invalid project' });
    }

    if (GLOBAL_LEVELS.has(req.user.level)) return next();
    if (Number(req.user.id_project) !== projectId) {
      return res.status(403).render('errors/403', { title: 'Access denied' });
    }
    next();
  } catch (error) {
    next(error);
  }
}

export function requireWellBelongsToProject(req, res, next) {
  try {
    const projectId = Number(req.params.projectId || req.params.project_id);
    const wellId = Number(req.params.wellId || req.params.wellinfo_id);
    const well = get(
      `SELECT id_wellinfo, id_project, validation_status, created_by_user_id,
              submitted_at, validated_by_user_id, validated_at, lockreport
       FROM wellinfo
       WHERE id_wellinfo = ? AND id_project = ?
       LIMIT 1`,
      [wellId, projectId]
    );
    if (!well) return res.status(404).render('errors/404', { title: 'Report not found' });
    req.wellinfo = well;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireReportOpenAccess(req, res, next) {
  try {
    const report = req.wellinfo || get(
      'SELECT id_wellinfo, validation_status FROM wellinfo WHERE id_wellinfo = ? LIMIT 1',
      [Number(req.params.wellId || req.params.wellinfo_id)]
    );
    if (!report) return res.status(404).render('errors/404', { title: 'Report not found' });
    if (operatorCanOpenReport(req.user, report)) return next();
    return res.status(403).render('errors/403', { title: 'Access denied' });
  } catch (error) {
    next(error);
  }
}

export function requireReportEditAccess(req, res, next) {
  try {
    const report = req.wellinfo || get(
      'SELECT id_wellinfo, validation_status FROM wellinfo WHERE id_wellinfo = ? LIMIT 1',
      [Number(req.params.wellId || req.params.wellinfo_id)]
    );
    if (!report) return res.status(404).render('errors/404', { title: 'Report not found' });
    if (operatorCanEditReport(req.user, report)) return next();
    return res.status(403).render('errors/403', {
      title: 'Report validated',
      message: 'This report has been validated for crew handover. Operators can still view the report and PDF, but only a Supervisor/Admin can edit it or re-open Operator editing.'
    });
  } catch (error) {
    next(error);
  }
}

export function requireAssetAccess(req, res, next) {
  try {
    if (isReportManager(req.user)) return next();
    const assetId = Number(req.params.assetId);
    const asset = get('SELECT id, id_project FROM assets_list WHERE id = ? LIMIT 1', [assetId]);
    if (!asset) return res.status(404).render('errors/404', { title: 'Asset not found' });
    if (Number(asset.id_project) !== Number(req.user.id_project)) {
      return res.status(403).render('errors/403', { title: 'Access denied' });
    }
    req.asset = asset;
    next();
  } catch (error) {
    next(error);
  }
}
