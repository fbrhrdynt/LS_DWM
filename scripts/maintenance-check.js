import assert from 'node:assert/strict';
import { calculatePmDue, dateDiffDays, dueState } from '../src/services/maintenance-calculations.js';

assert.equal(calculatePmDue('2026-01-01', 1, 'Day'), '2026-01-02');
assert.equal(calculatePmDue('2026-01-01', 2, 'Week'), '2026-01-15');
assert.equal(calculatePmDue('2026-01-31', 1, 'Month'), '2026-02-28');
assert.equal(calculatePmDue('2028-01-31', 1, 'Month'), '2028-02-29');
assert.equal(calculatePmDue('2028-02-29', 1, 'Year'), '2029-02-28');
assert.equal(dateDiffDays('2026-10-01', '2026-10-31'), 30);
assert.equal(dueState('2026-09-30', { today: '2026-10-01' }).key, 'expired');
assert.equal(dueState('2026-10-15', { today: '2026-10-01' }).key, 'warning');
assert.equal(dueState('2026-12-01', { today: '2026-10-01' }).key, 'valid');
assert.equal(dueState('2026-09-01', { completed: true, today: '2026-10-01' }).key, 'completed');

console.log('Maintenance calculation checks: OK');
