const BBL_PER_M3 = 6.2898;
const LEGACY_KG_PER_LB = 0.45359237;
const LEGACY_KG_PER_LB_SHORT = 0.45359;

function num(value) {
  if (value === null || value === undefined || value === '') return 0;
  const normalized = String(value).replaceAll(',', '').trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((finite(value) + Number.EPSILON) * factor) / factor;
}

function isBblUnit(value) {
  return String(value || '').toLowerCase().includes('bbl');
}

export function calculateWellFields(input = {}) {
  const bitsize = num(input.bitsize);
  const curdepth = num(input.curdepth);
  const depth1bef = num(input.depth1bef);
  const mudweight = num(input.mudweight);

  const bbl = ((bitsize ** 2) / 1029) * (curdepth - depth1bef) * 1.1;
  const m3 = bbl / BBL_PER_M3;

  let unit = String(input.volholeunit || '').toLowerCase();
  if (!['bbls', 'm3'].includes(unit)) {
    unit = String(input.depth_each || '').toLowerCase().startsWith('feet') ? 'bbls' : 'm3';
  }

  return {
    mwunit: mudweight >= 8.33 ? 'ppg' : 'sp.gr',
    volholeunit: unit,
    volholedrill: round(unit === 'bbls' ? bbl : m3, 2)
  };
}

export function calculateCentrifuge(prefix, input = {}, volholeunit = 'bbls') {
  const feedInRate = num(input[`${prefix}_feedinrate`]);
  const feedDensity = num(input[`${prefix}_feedindensity`]);
  const centrateDensity = num(input[`${prefix}_centratedens`]);
  const cakeDensity = num(input[`${prefix}_cakediscdens`]);
  const runningHour = num(input[`${prefix}_runninghour`]);

  const denominator = cakeDensity - centrateDensity;
  const cakeFlow = denominator !== 0
    ? feedInRate * (feedDensity - centrateDensity) / denominator
    : 0;
  const centrateReturn = feedInRate - cakeFlow;
  const volCakeBbl = runningHour * (cakeFlow * 60 / 42);

  // This reproduces the Laravel JavaScript exactly. Do not normalize CF1/CF2/CF3:
  // the old application used different metric Mass Cake behavior for CF1 vs CF2/CF3.
  const massCakeMton = (((cakeFlow * 42) * cakeDensity) * LEGACY_KG_PER_LB / 1000) * runningHour;

  let massCake = 0;
  let volCake = volCakeBbl;

  if (isBblUnit(volholeunit)) {
    massCake = massCakeMton;
  } else {
    if (prefix === 'cf1') {
      // Legacy CF1: total wet discharge in lb over the entered running hours.
      massCake = ((cakeFlow * 42) * cakeDensity) * runningHour;
    } else {
      // Legacy CF2/CF3: the old script converted massMton/runningHour with 0.45359.
      massCake = runningHour !== 0
        ? (massCakeMton / runningHour) / LEGACY_KG_PER_LB_SHORT * 1000
        : 0;
    }
    volCake = volCakeBbl / BBL_PER_M3;
  }

  return {
    [`${prefix}_cakediscflow`]: round(cakeFlow, 2),
    [`${prefix}_centratereturn`]: round(centrateReturn, 2),
    [`${prefix}_volcake`]: round(volCake, 2),
    [`${prefix}_masscake`]: round(massCake, 2)
  };
}

export function calculateSolidsControl(input = {}) {
  const runHour = num(input.run_hour);
  const volDischarge = num(input.vol_discharge);
  const feedDens = num(input.feed_dens);
  const overflowDens = num(input.overflow_dens);
  const underflowDens = num(input.underflow_dens);
  const mudCuttings = num(input.mudoncuttings);

  const densityDelta = feedDens - overflowDens;
  const feedRate = runHour > 0 && densityDelta !== 0
    ? (42 / (60 * runHour)) * volDischarge * (underflowDens - overflowDens) / densityDelta
    : 0;

  // Kept exactly from the original Laravel JavaScript.
  const volMudDischarge = mudCuttings * volDischarge * (1 + mudCuttings);

  return {
    feed_rate: round(feedRate, 2),
    volmud_discharge: round(volMudDischarge, 2)
  };
}

const RETORT_PREFIXES = ['sh', 'cdu', 'cf1', 'cf2', 'cf3'];
const RETORT_DEFAULT_PERCENT = {
  sh: 90,
  cdu: 80,
  cf1: 100,
  cf2: 100,
  cf3: 100
};

export function calculateRetort(input = {}, details = {}) {
  const result = { ...input };
  const sgbasefluid = num(details.sgbasefluid);
  const basefluid = num(details.basefluid);
  const mudweight = num(details.mudweight);
  const sgdrillsolid = num(details.sgdrillsolid);
  const volholedrill = num(details.volholedrill);

  for (const prefix of RETORT_PREFIXES) {
    const emptycell = num(result[`rt_${prefix}_emptycell`]);
    const emptycellwetsamp = num(result[`rt_${prefix}_emptycellwetsamp`]);
    const celldrycut = num(result[`rt_${prefix}_celldrycut`]);
    const emptycylinder = num(result[`rt_${prefix}_emptycylinder`]);
    const wtcylwaterbf = num(result[`rt_${prefix}_wtcylwaterbf`]);
    const watervolin = num(result[`rt_${prefix}_watervolin`]);
    const percentKey = `rt_${prefix}_percofcutting`;
    const percofcutting = result[percentKey] === null || result[percentKey] === undefined || result[percentKey] === ''
      ? RETORT_DEFAULT_PERCENT[prefix]
      : num(result[percentKey]);

    result[percentKey] = percofcutting;

    const massofdry = celldrycut - emptycell;
    const wtofwaterbf = wtcylwaterbf - emptycylinder;
    const massofcutting = emptycellwetsamp - emptycell;
    const massofbf = wtofwaterbf - watervolin;
    const basefluidvolincyl = sgbasefluid !== 0 ? massofbf / sgbasefluid : 0;

    let mudoncutting = 0;
    if (massofcutting !== 0 && sgdrillsolid !== 0 && basefluid !== 0 && sgbasefluid !== 0) {
      const bfFraction = basefluid / 100;
      const volbf = bfFraction !== 0 ? basefluidvolincyl / bfFraction : 0;
      const adjusted = (massofcutting - ((mudweight / 8.33) * volbf)) / sgdrillsolid;
      mudoncutting = adjusted !== 0 ? volbf / adjusted : 0;
    }

    let volmuddisc = 0;
    if (prefix === 'sh' || prefix === 'cdu') {
      volmuddisc = (volholedrill * percofcutting / 100) * mudoncutting;
    } else {
      const volcake = num(details[`${prefix}_volcake`]);
      volmuddisc = (1 + mudoncutting) !== 0
        ? mudoncutting * volcake / (1 + mudoncutting)
        : 0;
    }

    const volbfoildisc = volmuddisc * basefluid / 100;
    const ooc = massofcutting !== 0 ? (100 * massofbf / massofcutting) : 0;

    result[`rt_${prefix}_massofdry`] = round(massofdry, 1);
    result[`rt_${prefix}_wtofwaterbf`] = round(wtofwaterbf, 1);
    result[`rt_${prefix}_massofcutting`] = round(massofcutting, 1);
    result[`rt_${prefix}_massofbf`] = round(massofbf, 1);
    result[`rt_${prefix}_basefluidvolincyl`] = round(basefluidvolincyl, 1);
    result[`rt_${prefix}_mudoncutting`] = round(mudoncutting, 2);
    result[`rt_${prefix}_volmuddisc`] = round(volmuddisc, 2);
    result[`rt_${prefix}_volbfoildisc`] = round(volbfoildisc, 2);
    result[`rt_${prefix}_ooc`] = round(ooc, 2);
  }

  const mudRecovered =
    num(result.rt_sh_volmuddisc) -
    num(result.rt_cdu_volmuddisc) -
    num(result.rt_cf1_volmuddisc) -
    num(result.rt_cf2_volmuddisc) -
    num(result.rt_cf3_volmuddisc);
  const oilRecovered = mudRecovered * basefluid / 100;

  result.mud_recovered = round(mudRecovered, 1);
  result.oil_recovered = round(oilRecovered, 1);

  const shCut = num(result.rt_sh_percofcutting);
  const cduCut = num(result.rt_cdu_percofcutting);
  const vctodryerBbls = volholedrill * (shCut / 100);
  const vcfrdryerBbls = shCut !== 0
    ? vctodryerBbls * (cduCut / 100) / (shCut / 100)
    : 0;

  result.vctodryer_bbls = round(vctodryerBbls, 2);
  result.vctodryer_m3 = round(vctodryerBbls / BBL_PER_M3, 2);
  result.vcfrdryer_bbls = round(vcfrdryerBbls, 2);
  result.vcfrdryer_m3 = round(vcfrdryerBbls / BBL_PER_M3, 2);

  for (const n of [1, 2, 3]) {
    const mud = num(result[`rt_cf${n}_mudoncutting`]);
    const vol = num(result[`rt_cf${n}_volmuddisc`]);
    const bbls = mud !== 0 ? vol / mud : 0;
    result[`vcfrcf${n}_bbls`] = round(bbls, 2);
    result[`vcfrcf${n}_m3`] = round(bbls / BBL_PER_M3, 2);
  }

  return result;
}

export function calculateDailyWaste({ details = {}, desander = {}, desilter = {}, retort = {} } = {}) {
  const bitsize = num(details.bitsize);
  const volholedrill = num(details.volholedrill);

  // These steps intentionally follow the original Laravel DailyWasteController.
  const wmFrwell = ((bitsize / 1029) * volholedrill) * 1.1;
  const wmFrsh12 = wmFrwell * 0.9;
  const wmFrsh34 = wmFrwell * 0.9;
  const wmTocdu = wmFrsh12 - wmFrsh34;
  const wmFrcdu = (wmTocdu * 80) / 90;

  const desanderMud = num(desander.mudoncuttings) || 1;
  const desilterMud = num(desilter.mudoncuttings) || 1;
  const wmDesanderDesilter =
    num(desander.vol_discharge) / desanderMud +
    num(desilter.vol_discharge) / desilterMud;

  const rtCduMud = num(retort.rt_cdu_mudoncutting) || 1;
  const wmFrmMudclean = wmDesanderDesilter / rtCduMud;

  const cf = [1, 2, 3].map(n => {
    const mud = num(retort[`rt_cf${n}_mudoncutting`]);
    const vol = num(retort[`rt_cf${n}_volmuddisc`]);
    return mud !== 0 ? vol / mud : 0;
  });

  const womFrsh12 = wmFrsh12 * num(retort.rt_sh_mudoncutting);
  const womFrsh34 = wmFrsh34 * num(retort.rt_cdu_mudoncutting);
  const womFrcdu = wmFrcdu * num(retort.rt_cdu_mudoncutting);
  const womFrmMudclean = wmDesanderDesilter;
  const womCf = cf.map((value, i) => value * num(retort[`rt_cf${i + 1}_mudoncutting`]));

  const totalWm =
    wmFrsh12 + wmFrsh34 + wmFrcdu + wmFrmMudclean + wmDesanderDesilter +
    cf[0] + cf[1] + cf[2];

  const totalWom =
    womFrsh12 + womFrsh34 + womFrcdu + womFrmMudclean +
    womCf[0] + womCf[1] + womCf[2];

  const dailyWasteGenerated = totalWm + totalWom;
  const avgMoc = totalWom !== 0 ? totalWm / totalWom : 0;
  const denominator =
    totalWm * num(details.sgdrillsolid) +
    (totalWom * num(details.mudweight) / 8.33);
  const avgDischarge = denominator !== 0
    ? ((totalWom * num(details.sgbasefluid) * num(details.basefluid)) / denominator) * 100
    : 0;

  return {
    dailywaste_generated: round(dailyWasteGenerated, 2),
    avg_moc: round(avgMoc, 2),
    avg_discharge: round(avgDischarge, 2)
  };
}

export const constants = { BBL_PER_M3 };
