import assert from 'node:assert/strict';
import {
  formatReportNumber,
  nextReportDate,
  nextReportNumber
} from '../src/services/report-sequence.js';

assert.equal(formatReportNumber('3.0'), '3');
assert.equal(formatReportNumber(7), '7');
assert.equal(nextReportNumber('2.0', 2), 3);
assert.equal(nextReportNumber('2', 5), 6);
assert.equal(nextReportDate('2026-10-01'), '2026-10-02');
assert.equal(nextReportDate('2028-02-28'), '2028-02-29');
assert.equal(nextReportDate('2028-02-29'), '2028-03-01');
assert.equal(nextReportDate('invalid'), null);

console.log('Report copy/number checks: OK');
