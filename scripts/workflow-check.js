import {
  isReportManager,
  normalizeReportState,
  operatorCanEditReport,
  operatorCanOpenReport,
  REPORT_STATES
} from '../src/services/report-workflow.service.js';

const admin = { id_user: 1, level: 'MASTER' };
const supervisor = { id_user: 2, level: 'Supervisor' };
const operator = { id_user: 3, level: 'Operator' };

if (!isReportManager(admin) || !isReportManager(supervisor) || isReportManager(operator)) {
  throw new Error('Manager role classification failed.');
}
if (!operatorCanOpenReport(operator, { validation_status: REPORT_STATES.DRAFT })) {
  throw new Error('Operator must be able to open Draft reports.');
}
if (!operatorCanOpenReport(operator, { validation_status: REPORT_STATES.PENDING })) {
  throw new Error('Operator must be able to open Pending reports until validation.');
}
if (!operatorCanOpenReport(operator, { validation_status: REPORT_STATES.VALIDATED })) {
  throw new Error('Operator must still be able to open/view Validated reports.');
}
if (operatorCanEditReport(operator, { validation_status: REPORT_STATES.VALIDATED })) {
  throw new Error('Operator must not be able to edit Validated reports.');
}
if (!operatorCanEditReport(operator, { validation_status: REPORT_STATES.PENDING })) {
  throw new Error('Operator must remain able to edit Pending reports before handover validation.');
}
if (!operatorCanOpenReport(supervisor, { validation_status: REPORT_STATES.VALIDATED })) {
  throw new Error('Supervisor must be able to open Validated reports.');
}
if (normalizeReportState('unknown') !== REPORT_STATES.DRAFT) {
  throw new Error('Unknown report state must normalize to Draft.');
}
console.log('Workflow checks: OK - validated reports remain viewable/PDF-accessible while Operator editing is frozen');
