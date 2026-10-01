import { wellSummaryColumnCount, mapWellSummaryRow } from '../src/services/well-summary.service.js';

const sample = {
  cf1_sn: 'CF1',
  cf2_sn: 'CF2',
  cf3_sn: 'CF3',
  cdu1_model: 'CD',
  cdu1_sn: '001'
};

const columns = wellSummaryColumnCount([sample]);
const row = mapWellSummaryRow(sample);

if (columns !== 90) {
  throw new Error(`Expected 90 Well Summary columns, got ${columns}.`);
}

if (row.length !== columns) {
  throw new Error(`Well Summary mapping mismatch: ${row.length} row values for ${columns} columns.`);
}

console.log(`Export checks: OK (${columns} Well Summary columns)`);
