import { all, get, run } from '../config/db.js';
import {
  calculateWellFields,
  calculateCentrifuge,
  calculateSolidsControl,
  calculateRetort,
  calculateDailyWaste
} from './report-calculations.js';

const RETORT_PREFIXES = ['sh', 'cdu', 'cf1', 'cf2', 'cf3'];
const RETORT_CALCULATED_KEYS = [
  'basefluidvolincyl',
  'massofcutting',
  'massofdry',
  'wtofwaterbf',
  'massofbf',
  'mudoncutting',
  'percofcutting',
  'volbfoildisc',
  'volmuddisc',
  'ooc'
];
const VOLUME_CONTROL_KEYS = [
  'vctodryer_bbls', 'vctodryer_m3',
  'vcfrdryer_bbls', 'vcfrdryer_m3',
  'vcfrcf1_bbls', 'vcfrcf1_m3',
  'vcfrcf2_bbls', 'vcfrcf2_m3',
  'vcfrcf3_bbls', 'vcfrcf3_m3'
];

function updateColumns(table, wellId, values, allowedKeys) {
  const columns = new Set(all(`PRAGMA table_info("${table}")`).map(row => row.name));
  const entries = allowedKeys
    .filter(key => columns.has(key) && Object.hasOwn(values, key))
    .map(key => [key, values[key]]);

  if (!entries.length) return;

  const assignments = entries.map(([key]) => `"${key}" = ?`);
  const params = entries.map(([, value]) => value);
  if (columns.has('updated_at')) assignments.push(`updated_at = datetime('now')`);

  run(
    `UPDATE "${table}" SET ${assignments.join(', ')} WHERE id_wellinfo = ?`,
    [...params, wellId]
  );
}

function ensureRow(table, wellId) {
  const row = get(`SELECT id_wellinfo FROM "${table}" WHERE id_wellinfo = ? LIMIT 1`, [wellId]);
  if (!row) run(`INSERT INTO "${table}" (id_wellinfo) VALUES (?)`, [wellId]);
}

export function recalculateReportDerivedFields(wellId) {
  ensureRow('details', wellId);
  ensureRow('desanders', wellId);
  ensureRow('desilters', wellId);
  ensureRow('retorts', wellId);
  ensureRow('additional', wellId);
  ensureRow('dailywaste', wellId);

  let details = get('SELECT * FROM details WHERE id_wellinfo = ? LIMIT 1', [wellId]) || {};

  const well = calculateWellFields(details);
  updateColumns('details', wellId, well, ['mwunit', 'volholedrill', 'volholeunit']);
  details = { ...details, ...well };

  for (const n of [1, 2, 3]) {
    const prefix = `cf${n}`;
    const values = calculateCentrifuge(prefix, details, details.volholeunit);
    updateColumns('details', wellId, values, [
      `${prefix}_cakediscflow`,
      `${prefix}_centratereturn`,
      `${prefix}_masscake`,
      `${prefix}_volcake`
    ]);
    details = { ...details, ...values };
  }

  let desander = get('SELECT * FROM desanders WHERE id_wellinfo = ? LIMIT 1', [wellId]) || {};
  let desilter = get('SELECT * FROM desilters WHERE id_wellinfo = ? LIMIT 1', [wellId]) || {};

  const desanderCalc = calculateSolidsControl(desander);
  const desilterCalc = calculateSolidsControl(desilter);
  updateColumns('desanders', wellId, desanderCalc, ['feed_rate', 'volmud_discharge']);
  updateColumns('desilters', wellId, desilterCalc, ['feed_rate', 'volmud_discharge']);
  desander = { ...desander, ...desanderCalc };
  desilter = { ...desilter, ...desilterCalc };

  const retortRaw = get('SELECT * FROM retorts WHERE id_wellinfo = ? LIMIT 1', [wellId]) || {};
  const additionalRaw = get('SELECT * FROM additional WHERE id_wellinfo = ? LIMIT 1', [wellId]) || {};
  const retortCalc = calculateRetort({ ...retortRaw, ...additionalRaw }, details);

  const retortKeys = [
    ...RETORT_PREFIXES.flatMap(prefix =>
      RETORT_CALCULATED_KEYS.map(key => `rt_${prefix}_${key}`)
    ),
    'oil_recovered',
    'mud_recovered'
  ];
  updateColumns('retorts', wellId, retortCalc, retortKeys);
  updateColumns('additional', wellId, retortCalc, VOLUME_CONTROL_KEYS);

  const retort = { ...retortRaw, ...retortCalc };
  const dailyWaste = calculateDailyWaste({ details, desander, desilter, retort });
  updateColumns('dailywaste', wellId, dailyWaste, [
    'dailywaste_generated',
    'avg_moc',
    'avg_discharge'
  ]);

  return {
    well,
    centrifuges: {
      cf1: {
        cakediscflow: details.cf1_cakediscflow,
        centratereturn: details.cf1_centratereturn,
        masscake: details.cf1_masscake,
        volcake: details.cf1_volcake
      },
      cf2: {
        cakediscflow: details.cf2_cakediscflow,
        centratereturn: details.cf2_centratereturn,
        masscake: details.cf2_masscake,
        volcake: details.cf2_volcake
      },
      cf3: {
        cakediscflow: details.cf3_cakediscflow,
        centratereturn: details.cf3_centratereturn,
        masscake: details.cf3_masscake,
        volcake: details.cf3_volcake
      }
    },
    desander: desanderCalc,
    desilter: desilterCalc,
    retort: retortCalc,
    dailyWaste
  };
}
