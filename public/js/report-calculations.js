(() => {
  const form = document.querySelector('[data-report-editor]');
  if (!form) return;

  const section = form.dataset.reportSection || '';
  const contextNode = document.getElementById('reportCalcContext');
  let context = {};
  try { context = JSON.parse(contextNode?.textContent || '{}'); } catch { context = {}; }

  const BBL_PER_M3 = 6.2898;
  const $ = (name) => form.elements.namedItem(name);
  const num = (value) => {
    const parsed = Number(String(value ?? '').replaceAll(',', '').trim());
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const val = (name) => num($(name)?.value);
  const set = (name, value, digits = 2) => {
    const el = $(name);
    if (!el) return;
    const safe = Number.isFinite(value) ? value : 0;
    el.value = safe.toFixed(digits);
  };
  const bind = (names, fn) => {
    names.forEach(name => {
      const el = $(name);
      if (!el) return;
      el.addEventListener('input', fn);
      el.addEventListener('change', fn);
    });
    fn();
  };

  function calculateWell(syncDepthUnit = false) {
    if (syncDepthUnit) {
      const depthUnit = String($('depth_each')?.value || '').toLowerCase();
      const volumeUnit = $('volholeunit');
      if (volumeUnit) volumeUnit.value = depthUnit.startsWith('feet') ? 'bbls' : 'm3';
    }

    const bitsize = val('bitsize');
    const curdepth = val('curdepth');
    const previous = val('depth1bef');
    const bbl = ((bitsize ** 2) / 1029) * (curdepth - previous) * 1.1;
    const unit = String($('volholeunit')?.value || '').toLowerCase();
    set('volholedrill', unit === 'bbls' ? bbl : bbl / BBL_PER_M3, 2);

    const mwUnit = $('mwunit');
    if (mwUnit) mwUnit.value = val('mudweight') >= 8.33 ? 'ppg' : 'sp.gr';
  }

  function calculateCentrifuge(prefix) {
    const feedRate = val(`${prefix}_feedinrate`);
    const feedDensity = val(`${prefix}_feedindensity`);
    const centrateDensity = val(`${prefix}_centratedens`);
    const cakeDensity = val(`${prefix}_cakediscdens`);
    const runningHour = val(`${prefix}_runninghour`);
    const denominator = cakeDensity - centrateDensity;
    const cakeFlow = denominator !== 0
      ? feedRate * (feedDensity - centrateDensity) / denominator
      : 0;
    const centrate = feedRate - cakeFlow;
    const volCakeBbl = runningHour * (cakeFlow * 60 / 42);
    const massMton = (((cakeFlow * 42) * cakeDensity) * 0.45359237 / 1000) * runningHour;
    const unit = String(context.details?.volholeunit || 'bbls').toLowerCase();

    let massCake;
    let volCake;
    if (unit.includes('bbl')) {
      massCake = massMton;
      volCake = volCakeBbl;
    } else {
      massCake = prefix === 'cf1'
        ? ((cakeFlow * 42) * cakeDensity) * runningHour
        : (runningHour !== 0 ? (massMton / runningHour) / 0.45359 * 1000 : 0);
      volCake = volCakeBbl / BBL_PER_M3;
    }

    set(`${prefix}_cakediscflow`, cakeFlow, 2);
    set(`${prefix}_centratereturn`, centrate, 2);
    set(`${prefix}_masscake`, massCake, 2);
    set(`${prefix}_volcake`, volCake, 2);
  }

  function calculateSolids() {
    const runHour = val('run_hour');
    const volDischarge = val('vol_discharge');
    const feedDens = val('feed_dens');
    const overflowDens = val('overflow_dens');
    const underflowDens = val('underflow_dens');
    const mudCuttings = val('mudoncuttings');
    const delta = feedDens - overflowDens;
    const feedRate = runHour > 0 && delta !== 0
      ? (42 / (60 * runHour)) * volDischarge * (underflowDens - overflowDens) / delta
      : 0;
    const volMud = mudCuttings * volDischarge * (1 + mudCuttings);
    set('feed_rate', feedRate, 2);
    set('volmud_discharge', volMud, 2);
  }

  function calculateRetort() {
    const details = context.details || {};
    const sgbasefluid = num(details.sgbasefluid);
    const basefluid = num(details.basefluid);
    const mudweight = num(details.mudweight);
    const sgdrillsolid = num(details.sgdrillsolid);
    const volholedrill = num(details.volholedrill);
    const defaults = { sh: 90, cdu: 80, cf1: 100, cf2: 100, cf3: 100 };

    ['sh', 'cdu', 'cf1', 'cf2', 'cf3'].forEach(prefix => {
      const percentEl = $(`rt_${prefix}_percofcutting`);
      if (percentEl && String(percentEl.value).trim() === '') percentEl.value = defaults[prefix];
      const percent = val(`rt_${prefix}_percofcutting`);
      const emptycell = val(`rt_${prefix}_emptycell`);
      const wet = val(`rt_${prefix}_emptycellwetsamp`);
      const dryCell = val(`rt_${prefix}_celldrycut`);
      const emptyCylinder = val(`rt_${prefix}_emptycylinder`);
      const cylinderWaterBf = val(`rt_${prefix}_wtcylwaterbf`);
      const waterVol = val(`rt_${prefix}_watervolin`);

      const massDry = dryCell - emptycell;
      const waterBfWeight = cylinderWaterBf - emptyCylinder;
      const massWet = wet - emptycell;
      const massBf = waterBfWeight - waterVol;
      const baseFluidVol = sgbasefluid !== 0 ? massBf / sgbasefluid : 0;

      let moc = 0;
      if (massWet !== 0 && sgdrillsolid !== 0 && basefluid !== 0 && sgbasefluid !== 0) {
        const bfFraction = basefluid / 100;
        const volBf = bfFraction !== 0 ? baseFluidVol / bfFraction : 0;
        const adjusted = (massWet - ((mudweight / 8.33) * volBf)) / sgdrillsolid;
        moc = adjusted !== 0 ? volBf / adjusted : 0;
      }

      let mudDischarge;
      if (prefix === 'sh' || prefix === 'cdu') {
        mudDischarge = (volholedrill * percent / 100) * moc;
      } else {
        const volCake = num(details[`${prefix}_volcake`]);
        mudDischarge = (1 + moc) !== 0 ? moc * volCake / (1 + moc) : 0;
      }

      set(`rt_${prefix}_massofdry`, massDry, 1);
      set(`rt_${prefix}_wtofwaterbf`, waterBfWeight, 1);
      set(`rt_${prefix}_massofcutting`, massWet, 1);
      set(`rt_${prefix}_massofbf`, massBf, 1);
      set(`rt_${prefix}_basefluidvolincyl`, baseFluidVol, 1);
      set(`rt_${prefix}_mudoncutting`, moc, 2);
      set(`rt_${prefix}_volmuddisc`, mudDischarge, 2);
      set(`rt_${prefix}_volbfoildisc`, mudDischarge * basefluid / 100, 2);
      set(`rt_${prefix}_ooc`, massWet !== 0 ? 100 * massBf / massWet : 0, 2);
    });

    const mudRecovered =
      val('rt_sh_volmuddisc') - val('rt_cdu_volmuddisc') -
      val('rt_cf1_volmuddisc') - val('rt_cf2_volmuddisc') - val('rt_cf3_volmuddisc');
    set('mud_recovered', mudRecovered, 1);
    set('oil_recovered', mudRecovered * basefluid / 100, 1);

    const shCut = val('rt_sh_percofcutting');
    const cduCut = val('rt_cdu_percofcutting');
    const toDryer = volholedrill * shCut / 100;
    const fromDryer = shCut !== 0 ? toDryer * (cduCut / 100) / (shCut / 100) : 0;
    set('vctodryer_bbls', toDryer, 2);
    set('vctodryer_m3', toDryer / BBL_PER_M3, 2);
    set('vcfrdryer_bbls', fromDryer, 2);
    set('vcfrdryer_m3', fromDryer / BBL_PER_M3, 2);

    [1, 2, 3].forEach(n => {
      const mud = val(`rt_cf${n}_mudoncutting`);
      const vol = val(`rt_cf${n}_volmuddisc`);
      const bbl = mud !== 0 ? vol / mud : 0;
      set(`vcfrcf${n}_bbls`, bbl, 2);
      set(`vcfrcf${n}_m3`, bbl / BBL_PER_M3, 2);
    });
  }

  function calculateWaste() {
    const d = context.details || {};
    const ds = context.desander || {};
    const di = context.desilter || {};
    const rt = context.retort || {};
    const n = num;

    const wmFrwell = ((n(d.bitsize) / 1029) * n(d.volholedrill)) * 1.1;
    const wmFrsh12 = wmFrwell * 0.9;
    const wmFrsh34 = wmFrwell * 0.9;
    const wmTocdu = wmFrsh12 - wmFrsh34;
    const wmFrcdu = wmTocdu * 80 / 90;
    const wmDsDi = n(ds.vol_discharge) / (n(ds.mudoncuttings) || 1) + n(di.vol_discharge) / (n(di.mudoncuttings) || 1);
    const wmMudclean = wmDsDi / (n(rt.rt_cdu_mudoncutting) || 1);
    const wmCf = [1, 2, 3].map(i => n(rt[`rt_cf${i}_mudoncutting`]) !== 0
      ? n(rt[`rt_cf${i}_volmuddisc`]) / n(rt[`rt_cf${i}_mudoncutting`])
      : 0);
    const womSh12 = wmFrsh12 * n(rt.rt_sh_mudoncutting);
    const womSh34 = wmFrsh34 * n(rt.rt_cdu_mudoncutting);
    const womCdu = wmFrcdu * n(rt.rt_cdu_mudoncutting);
    const womMudclean = wmDsDi;
    const womCf = wmCf.map((v, i) => v * n(rt[`rt_cf${i + 1}_mudoncutting`]));
    const totalWm = wmFrsh12 + wmFrsh34 + wmFrcdu + wmMudclean + wmDsDi + wmCf.reduce((a,b)=>a+b,0);
    const totalWom = womSh12 + womSh34 + womCdu + womMudclean + womCf.reduce((a,b)=>a+b,0);
    const denominator = totalWm * n(d.sgdrillsolid) + (totalWom * n(d.mudweight) / 8.33);

    set('dailywaste_generated', totalWm + totalWom, 2);
    set('avg_moc', totalWom !== 0 ? totalWm / totalWom : 0, 2);
    set('avg_discharge', denominator !== 0 ? ((totalWom * n(d.sgbasefluid) * n(d.basefluid)) / denominator) * 100 : 0, 2);
  }

  if (section === 'well') {
    bind(['bitsize', 'curdepth', 'depth1bef', 'mudweight', 'volholeunit'], () => calculateWell(false));
    $('depth_each')?.addEventListener('change', () => calculateWell(true));
  } else if (/^centrifuge[123]$/.test(section)) {
    const prefix = `cf${section.slice(-1)}`;
    bind([
      `${prefix}_feedinrate`, `${prefix}_feedindensity`, `${prefix}_centratedens`,
      `${prefix}_cakediscdens`, `${prefix}_runninghour`
    ], () => calculateCentrifuge(prefix));
  } else if (section === 'desander' || section === 'desilter') {
    bind(['run_hour', 'vol_discharge', 'feed_dens', 'overflow_dens', 'underflow_dens', 'mudoncuttings'], calculateSolids);
  } else if (section === 'retort') {
    const watched = [];
    ['sh', 'cdu', 'cf1', 'cf2', 'cf3'].forEach(prefix => {
      ['emptycell', 'emptycellwetsamp', 'celldrycut', 'emptycylinder', 'wtcylwaterbf', 'watervolin']
        .forEach(field => watched.push(`rt_${prefix}_${field}`));
    });
    bind(watched, calculateRetort);
  } else if (section === 'waste') {
    calculateWaste();
  }
})();
