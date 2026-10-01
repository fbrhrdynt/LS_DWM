import assert from 'node:assert/strict';
import {
  calculateWellFields,
  calculateCentrifuge,
  calculateSolidsControl,
  calculateRetort,
  calculateDailyWaste
} from '../src/services/report-calculations.js';

const close = (actual, expected, tolerance = 0.02) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
};

const well = calculateWellFields({
  bitsize: 8.5,
  curdepth: 1000,
  depth1bef: 900,
  mudweight: 10,
  depth_each: 'feet',
  volholeunit: 'bbls'
});
close(well.volholedrill, ((8.5 ** 2) / 1029) * 100 * 1.1);
assert.equal(well.mwunit, 'ppg');
assert.equal(well.volholeunit, 'bbls');

const cf = calculateCentrifuge('cf1', {
  cf1_feedinrate: 100,
  cf1_feedindensity: 12,
  cf1_centratedens: 10,
  cf1_cakediscdens: 20,
  cf1_runninghour: 2
}, 'bbls');
close(cf.cf1_cakediscflow, 20);
close(cf.cf1_centratereturn, 80);
close(cf.cf1_volcake, 57.14);

const solids = calculateSolidsControl({
  run_hour: 2,
  vol_discharge: 10,
  feed_dens: 12,
  overflow_dens: 10,
  underflow_dens: 14,
  mudoncuttings: 0.2
});
close(solids.feed_rate, 7);
close(solids.volmud_discharge, 2.4);

const details = {
  sgbasefluid: 0.8,
  basefluid: 80,
  mudweight: 10,
  sgdrillsolid: 2.6,
  volholedrill: 100,
  cf1_volcake: 10,
  cf2_volcake: 10,
  cf3_volcake: 10,
  bitsize: 8.5
};
const rawRetort = {};
for (const prefix of ['sh', 'cdu', 'cf1', 'cf2', 'cf3']) {
  Object.assign(rawRetort, {
    [`rt_${prefix}_emptycell`]: 10,
    [`rt_${prefix}_emptycellwetsamp`]: 30,
    [`rt_${prefix}_celldrycut`]: 22,
    [`rt_${prefix}_emptycylinder`]: 5,
    [`rt_${prefix}_wtcylwaterbf`]: 15,
    [`rt_${prefix}_watervolin`]: 4
  });
}
const retort = calculateRetort(rawRetort, details);
assert.equal(retort.rt_sh_percofcutting, 90);
assert.equal(retort.rt_cdu_percofcutting, 80);
assert.equal(retort.rt_cf1_percofcutting, 100);
for (const key of ['rt_sh_mudoncutting', 'rt_cdu_volmuddisc', 'oil_recovered', 'vctodryer_bbls', 'vcfrcf1_m3']) {
  assert.ok(Number.isFinite(Number(retort[key])), `${key} is not finite`);
}

const waste = calculateDailyWaste({
  details,
  desander: { vol_discharge: 5, mudoncuttings: 0.2 },
  desilter: { vol_discharge: 4, mudoncuttings: 0.25 },
  retort
});
for (const value of Object.values(waste)) assert.ok(Number.isFinite(value));

console.log('Formula checks: OK');
