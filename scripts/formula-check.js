import assert from 'node:assert/strict';
import {
  calculateWellFields,
  calculateCentrifuge,
  calculateSolidsControl,
  calculateRetort,
  calculateDailyWaste
} from '../src/services/report-calculations.js';

const close = (actual, expected, tolerance = 0.02) => {
  assert.ok(Number.isFinite(Number(actual)), `${actual} is not finite`);
  assert.ok(Math.abs(Number(actual) - Number(expected)) <= tolerance, `${actual} != ${expected}`);
};

// WELL DATA: Hole Volume Drilled + automatic mud-weight unit.
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

const metricWell = calculateWellFields({
  bitsize: 8.5,
  curdepth: 1000,
  depth1bef: 900,
  mudweight: 1.2,
  depth_each: 'metre',
  volholeunit: 'm3'
});
close(metricWell.volholedrill, (((8.5 ** 2) / 1029) * 100 * 1.1) / 6.2898);
assert.equal(metricWell.mwunit, 'sp.gr');

// CENTRIFUGE 1/2/3: cake flow, centrate return, mass and volume cake.
for (const prefix of ['cf1', 'cf2', 'cf3']) {
  const input = {
    [`${prefix}_feedinrate`]: 100,
    [`${prefix}_feedindensity`]: 12,
    [`${prefix}_centratedens`]: 10,
    [`${prefix}_cakediscdens`]: 20,
    [`${prefix}_runninghour`]: 2
  };
  const cf = calculateCentrifuge(prefix, input, 'bbls');
  close(cf[`${prefix}_cakediscflow`], 20);
  close(cf[`${prefix}_centratereturn`], 80);
  close(cf[`${prefix}_volcake`], 57.14);
  assert.ok(Number(cf[`${prefix}_masscake`]) > 0);

  const metric = calculateCentrifuge(prefix, input, 'm3');
  close(metric[`${prefix}_volcake`], 57.14 / 6.2898);
  assert.ok(Number.isFinite(Number(metric[`${prefix}_masscake`])));
}

// DESANDER / DESILTER.
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

// RETORT worksheet: all legacy automatic result fields.
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
assert.equal(retort.rt_cf2_percofcutting, 100);
assert.equal(retort.rt_cf3_percofcutting, 100);

for (const prefix of ['sh', 'cdu', 'cf1', 'cf2', 'cf3']) {
  for (const key of [
    'basefluidvolincyl', 'massofcutting', 'massofdry', 'wtofwaterbf',
    'massofbf', 'mudoncutting', 'volmuddisc', 'volbfoildisc', 'ooc'
  ]) {
    assert.ok(Number.isFinite(Number(retort[`rt_${prefix}_${key}`])), `${prefix}.${key} is not finite`);
  }
}
for (const key of [
  'oil_recovered', 'mud_recovered',
  'vctodryer_bbls', 'vctodryer_m3', 'vcfrdryer_bbls', 'vcfrdryer_m3',
  'vcfrcf1_bbls', 'vcfrcf1_m3', 'vcfrcf2_bbls', 'vcfrcf2_m3',
  'vcfrcf3_bbls', 'vcfrcf3_m3'
]) {
  assert.ok(Number.isFinite(Number(retort[key])), `${key} is not finite`);
}

// DAILY WASTE + Avg MOC + Avg discharge OOC.
const waste = calculateDailyWaste({
  details,
  desander: { vol_discharge: 5, mudoncuttings: 0.2 },
  desilter: { vol_discharge: 4, mudoncuttings: 0.25 },
  retort
});
for (const [key, value] of Object.entries(waste)) {
  assert.ok(Number.isFinite(Number(value)), `${key} is not finite`);
}

// Invalid/zero denominators must never create NaN or Infinity in saved reports.
const safeCf = calculateCentrifuge('cf1', {
  cf1_feedinrate: 100,
  cf1_feedindensity: 10,
  cf1_centratedens: 10,
  cf1_cakediscdens: 10,
  cf1_runninghour: 0
}, 'bbls');
for (const value of Object.values(safeCf)) assert.ok(Number.isFinite(Number(value)));

console.log('Formula checks: OK - Well, CF1/2/3, Desander/Desilter, Retort, Recovery, Volume Control and Daily Waste');
