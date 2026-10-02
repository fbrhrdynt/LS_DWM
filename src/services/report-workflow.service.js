import { get, run } from '../config/db.js';

export const REPORT_MANAGERS = new Set(['MASTER', 'Supervisor']);
export const REPORT_STATES = Object.freeze({
  DRAFT: 'DRAFT',
  PENDING: 'PENDING',
  VALIDATED: 'VALIDATED'
});

export function isReportManager(user) {
  return REPORT_MANAGERS.has(user?.level);
}

export function normalizeReportState(value) {
  const state = String(value || '').toUpperCase();
  return Object.values(REPORT_STATES).includes(state) ? state : REPORT_STATES.DRAFT;
}

export function reportStateLabel(value) {
  return ({
    DRAFT: 'Draft',
    PENDING: 'Pending validation',
    VALIDATED: 'Validated'
  })[normalizeReportState(value)];
}

export function operatorCanOpenReport(user, report) {
  // Validation is a handover/edit freeze, not a visibility lock.
  // Any user who can access the project may still open/view the report and PDF.
  return Boolean(user && report);
}

export function operatorCanEditReport(user, report) {
  if (isReportManager(user)) return true;
  return normalizeReportState(report?.validation_status) !== REPORT_STATES.VALIDATED;
}

export function markReportSaved(wellId, user) {
  if (isReportManager(user)) {
    run(
      `UPDATE wellinfo
       SET validation_status = 'VALIDATED',
           lockreport = 'YES',
           created_by_user_id = COALESCE(created_by_user_id, ?),
           submitted_at = COALESCE(submitted_at, datetime('now')),
           validated_by_user_id = ?,
           validated_at = datetime('now'),
           updated_at = datetime('now')
       WHERE id_wellinfo = ?`,
      [Number(user.id_user), Number(user.id_user), wellId]
    );
    return REPORT_STATES.VALIDATED;
  }

  run(
    `UPDATE wellinfo
     SET validation_status = 'PENDING',
         lockreport = 'NO',
         created_by_user_id = COALESCE(created_by_user_id, ?),
         submitted_at = datetime('now'),
         validated_by_user_id = NULL,
         validated_at = NULL,
         updated_at = datetime('now')
     WHERE id_wellinfo = ?`,
    [Number(user.id_user), wellId]
  );
  return REPORT_STATES.PENDING;
}

export function validateReport(wellId, user) {
  if (!isReportManager(user)) throw new Error('Only Supervisor or Admin can validate reports.');
  run(
    `UPDATE wellinfo
     SET validation_status = 'VALIDATED',
         lockreport = 'YES',
         validated_by_user_id = ?,
         validated_at = datetime('now'),
         updated_at = datetime('now')
     WHERE id_wellinfo = ?`,
    [Number(user.id_user), wellId]
  );
}

export function reopenReport(wellId, user) {
  if (!isReportManager(user)) throw new Error('Only Supervisor or Admin can re-open reports.');
  run(
    `UPDATE wellinfo
     SET validation_status = 'DRAFT',
         lockreport = 'NO',
         submitted_at = NULL,
         validated_by_user_id = NULL,
         validated_at = NULL,
         updated_at = datetime('now')
     WHERE id_wellinfo = ?`,
    [wellId]
  );
}

export function workflowForNewReport(user) {
  if (isReportManager(user)) {
    return {
      validationStatus: REPORT_STATES.VALIDATED,
      lockreport: 'YES',
      validatedBy: Number(user.id_user)
    };
  }
  return {
    validationStatus: REPORT_STATES.DRAFT,
    lockreport: 'NO',
    validatedBy: null
  };
}

export function reportWorkflowRow(wellId) {
  return get(
    `SELECT id_wellinfo, id_project, validation_status, created_by_user_id,
            submitted_at, validated_by_user_id, validated_at, lockreport
     FROM wellinfo WHERE id_wellinfo = ? LIMIT 1`,
    [wellId]
  );
}
