import { all, get, run, transaction } from '../config/db.js';
import {
  calculateWellFields,
  calculateCentrifuge,
  calculateSolidsControl,
  calculateRetort,
  calculateDailyWaste
} from '../services/report-calculations.js';
import { deleteReportTree } from '../services/relational-cleanup.service.js';
import { nextReportDate, nextReportNumber, formatReportNumber } from '../services/report-sequence.js';
import { recalculateReportDerivedFields } from '../services/report-recalculation.service.js';
import { getReportSettings } from '../services/report-settings.service.js';
import { FLUID_TYPE_OPTIONS, activeMudCategoryMeta } from '../services/fluid-category.service.js';
import { isReportManager, markReportSaved, reopenReport, validateReport, workflowForNewReport } from '../services/report-workflow.service.js';

const REPORT_TABLES = [
  'details',
  'retorts',
  'desanders',
  'desilters',
  'cuttingsbypassed',
  'dailywaste',
  'additional',
  'personnel'
];

const MANAGER_LEVELS = new Set(['MASTER', 'Supervisor']);


const CENTRIFUGE_MODEL_OPTIONS = Object.freeze([
  { value: '7200VFD', label: 'DE-7200 VFD' },
  { value: '1000FHD', label: 'DE-1000 FHD' },
  { value: '1000VFD', label: 'DE-1000 VFD' },
  { value: '1000GBD', label: 'DE-1000 GBD' },
  { value: '1000FRDRYER', label: 'DE-1000 fr DRYER' },
  { value: 'HNH', label: 'CENTRIFUGE H&H' },
  { value: 'CSI', label: 'CENTRIFUGE CSI' }
]);

const CENTRIFUGE_MODE_OPTIONS = Object.freeze([
  { value: 'FRDREYR', label: 'FR DRYER' },
  { value: 'SLDREMOVAL', label: 'SOLID REMOVAL' },
  { value: 'BARITE', label: 'BARITE RECOVERY' }
]);

const CENTRIFUGE_FLOW_DESTINATIONS = Object.freeze([
  'INTERMEDIATETANK',
  'SANDTRAPTANK',
  'ACTIVETANK',
  'HOLDINGTANK',
  'CUTTINGSKIPS',
  'OVERBOARD'
]);

const CENTRIFUGE_UNDERFLOW_DESTINATIONS = Object.freeze([
  ...CENTRIFUGE_FLOW_DESTINATIONS,
  'JUMBOBAG'
]);

function todayLocal() {
  const timeZone = process.env.APP_TIMEZONE || 'Asia/Jakarta';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

class InputError extends Error {
  constructor(message, status = 422) {
    super(message);
    this.status = status;
  }
}

function field(name, label, type = 'text', options = {}) {
  return { name, label, type, ...options };
}

const SECTION_DEFS = {
  report: {
    label: 'Report Info',
    table: 'wellinfo',
    groups: [{
      title: 'Daily report',
      description: 'Core report information and people in charge.',
      fields: [
        field('curdate', 'Report date', 'date', { required: true }),
        field('platform', 'Platform / Contract'),
        field('wellname', 'Well name'),
        field('spud_date', 'Spud date', 'date'),
        field('location', 'Location'),
        field('companyman', 'Company man'),
        field('oim', 'OIM'),
        field('mudeng', 'Mud engineer'),
        field('urut', 'Report number', 'number', { step: '1', min: '1' })
      ]
    }]
  },
  well: {
    label: 'Well Data',
    table: 'details',
    groups: [{
      title: 'Well information',
      description: 'Drilling and active-system values used throughout the report.',
      fields: [
        field('mudcheck_type', 'Mud check type', 'select', { options: FLUID_TYPE_OPTIONS }),
        field('depth_each', 'Depth unit', 'select', { options: ['feet', 'metre'] }),
        field('depth1bef', 'Previous depth', 'number'),
        field('bitsize', 'Bit size', 'number'),
        field('bittype', 'Bit type'),
        field('washout', 'Washout', 'number'),
        field('mudweight', 'Mud weight', 'number'),
        field('mwunit', 'Mud weight unit', 'text', { calculated: true }),
        field('curdepth', 'Current depth', 'number'),
        field('volholedrill', 'Hole volume drilled', 'number', { calculated: true }),
        field('volholeunit', 'Hole volume unit', 'select', { options: ['bbls', 'm3'] }),
        field('avgrop', 'Average ROP', 'number'),
        field('lgsactive', 'LGS active', 'number'),
        field('datenow', 'Mud check date', 'date'),
        field('cirrategpm', 'Circulation rate (GPM)', 'number'),
        field('hgsactive', 'HGS active', 'number'),
        field('sgbasefluid', 'SG base fluid', 'number'),
        field('fluidtype', 'Fluid type', 'select', { options: FLUID_TYPE_OPTIONS }),
        field('rigpresentact', 'Rig present activity', 'textarea', { max: 500 }),
        field('activesysvol', 'Active system volume', 'number')
      ]
    }]
  },
  amp: {
    label: 'Active Mud',
    table: 'details',
    groups: [{
      title: 'Active mud properties',
      fields: [
        field('pv', 'PV', 'number'),
        field('yp', 'YP', 'number'),
        field('sandcontent', 'Sand content', 'number'),
        field('basefluid', 'Base fluid', 'number'),
        field('chlorides', 'Chlorides', 'number'),
        field('mudtemp', 'Mud temperature', 'number'),
        field('tempunit', 'Temperature unit'),
        field('categories1', 'Oil / Water Ratio'),
        field('categories2', 'MBT / E-Stability', 'number'),
        field('sgdrillsolid', 'SG drill solids', 'number')
      ]
    }]
  },
  shakers: {
    label: 'Shakers',
    table: 'details',
    groups: [
      ...[1, 2, 3, 4, 5, 6].map(n => ({
        title: `Shaker ${n}`,
        fields: [
          field(`sh${n}_name`, 'Name', 'text', { readonly: true }),
          field(`sh${n}_model`, 'Model'),
          field(`sh${n}_screensize`, 'Screen size'),
          field(`sh${n}_runninghour`, 'Running hour', 'number')
        ]
      })),
      {
        title: 'Screen changes',
        fields: [field('screens_changed', 'Screens changed', 'textarea', { max: 500 })]
      }
    ]
  },
  centrifuge1: centrifugeSection(1),
  centrifuge2: centrifugeSection(2),
  centrifuge3: centrifugeSection(3),
  cdu1: cuttingDryerSection(1),
  cdu2: cuttingDryerSection(2),
  desander: solidsSection('Desander', 'desanders'),
  desilter: solidsSection('Desilter', 'desilters'),
  bypassed: {
    label: 'By-Passed',
    table: 'cuttingsbypassed',
    groups: [{
      title: 'Cuttings by-passed',
      fields: [
        field('percentage', 'Percentage', 'number', { min: '0', max: '100' }),
        field('volume', 'Volume', 'number', { min: '0' }),
        field('from_depth', 'From depth', 'number', { min: '0' }),
        field('each_from_depth', 'From depth unit', 'select', { options: ['Metre', 'Feet'] }),
        field('to_depth', 'To depth', 'number', { min: '0' }),
        field('each_to_depth', 'To depth unit', 'select', { options: ['Metre', 'Feet'] })
      ]
    }]
  },
  waste: {
    label: 'Waste & Activity',
    special: 'waste',
    groups: [
      {
        title: 'Daily waste',
        fields: [
          field('dailywaste_generated', 'Daily waste generated', 'number', { calculated: true }),
          field('avg_moc', 'Average MOC', 'number', { calculated: true }),
          field('avg_discharge', 'Average discharge', 'number', { calculated: true })
        ]
      },
      {
        title: 'Activities',
        fields: [
          field('bssactivity', 'BSS activity', 'textarea', { max: 2000 }),
          field('rigactivity', 'Rig activity', 'textarea', { max: 2000 })
        ]
      }
    ]
  },
  personnel: {
    label: 'Personnel',
    table: 'personnel',
    groups: [{
      title: 'Personnel',
      fields: [
        field('ds1_name', 'Day shift 1'),
        field('ds2_name', 'Day shift 2'),
        field('ns1_name', 'Night shift 1'),
        field('ns2_name', 'Night shift 2')
      ]
    }]
  },
  retort: {
    label: 'Retort',
    special: 'retort',
    groups: retortGroups()
  }
};

function centrifugeSection(n) {
  const p = `cf${n}`;
  return {
    label: `Centrifuge ${n}`,
    table: 'details',
    groups: [{
      title: `Centrifuge ${n}`,
      fields: [
        field(`${p}_sn`, 'Serial number'),
        field(`${p}_model`, 'Model', 'select', { options: CENTRIFUGE_MODEL_OPTIONS }),
        field(`${p}_modeofopr`, 'Mode of operation', 'select', { options: CENTRIFUGE_MODE_OPTIONS }),
        field(`${p}_weirplate`, 'Weir plate', 'number'),
        field(`${p}_bowlspeed`, 'Bowl speed', 'number'),
        field(`${p}_bowlconv`, 'Bowl conveyor', 'number'),
        field(`${p}_feedsuc`, 'Feed-in Suction From', 'select', { options: CENTRIFUGE_FLOW_DESTINATIONS }),
        field(`${p}_effluentreturn`, 'Effluent Return To', 'select', { options: CENTRIFUGE_FLOW_DESTINATIONS }),
        field(`${p}_underflow`, 'Underflow Discharge To', 'select', { options: CENTRIFUGE_UNDERFLOW_DESTINATIONS }),
        field(`${p}_runninghour`, 'Running hour', 'number'),
        field(`${p}_feedinrate`, 'Feed-in rate', 'number'),
        field(`${p}_feedindensity`, 'Feed-in density', 'number'),
        field(`${p}_centratedens`, 'Centrate density', 'number'),
        field(`${p}_cakediscdens`, 'Cake discharge density', 'number'),
        field(`${p}_centratereturn`, 'Centrate return', 'number', { calculated: true }),
        field(`${p}_cakediscflow`, 'Cake discharge flow', 'number', { calculated: true }),
        field(`${p}_masscake`, 'Mass Wet Discharge / Day', 'number', { calculated: true }),
        field(`${p}_volcake`, 'Volume Cake Discharge', 'number', { calculated: true })
      ]
    }]
  };
}

function cuttingDryerSection(n) {
  const p = `cdu${n}`;
  return {
    label: `Cutting Dryer ${n}`,
    table: 'details',
    groups: [{
      title: `Cutting Dryer ${n}`,
      fields: [
        field(`${p}_sn`, 'Serial number'),
        field(`${p}_model`, 'Model', 'select', { options: CENTRIFUGE_MODEL_OPTIONS }),
        field(`${p}_screensize`, 'Screen size', 'number'),
        field(`${p}_runninghour`, 'Running hour', 'number'),
        field(`${p}_centrateppg`, 'Centrate PPG', 'number'),
        field(`${p}_scroll`, 'Scroll', 'number'),
        field(`${p}_sampledepth`, 'Sample depth', 'number')
      ]
    }]
  };
}

function solidsSection(label, table) {
  return {
    label,
    table,
    groups: [{
      title: label,
      fields: [
        field('run_hour', 'Run hour', 'number'),
        field('feed_rate', 'Feed rate', 'number', { calculated: true }),
        field('feed_dens', 'Feed density', 'number'),
        field('overflow_dens', 'Overflow density', 'number'),
        field('underflow_dens', 'Underflow density', 'number'),
        field('vol_discharge', 'Volume discharge', 'number'),
        field('mudoncuttings', 'Mud on cuttings', 'number'),
        field('volmud_discharge', 'Volume mud discharge', 'number', { calculated: true }),
        field('head_pressure', 'Head pressure', 'number')
      ]
    }]
  };
}

function retortGroups() {
  const labels = {
    sh: 'Shaker',
    cdu: 'Cutting Dryer',
    cf1: 'Centrifuge 1',
    cf2: 'Centrifuge 2',
    cf3: 'Centrifuge 3'
  };
  const calculated = new Set([
    'basefluidvolincyl', 'massofcutting', 'massofdry', 'wtofwaterbf', 'massofbf',
    'mudoncutting', 'percofcutting', 'volbfoildisc', 'volmuddisc', 'ooc'
  ]);
  const definitions = [
    ['sampletime', 'Sample time', 'time'],
    ['sampledepth', 'Sample depth', 'number'],
    ['emptycell', 'Empty cell', 'number'],
    ['emptycellwetsamp', 'Empty cell + wet sample', 'number'],
    ['celldrycut', 'Cell + dry cuttings', 'number'],
    ['emptycylinder', 'Empty cylinder', 'number'],
    ['watervolin', 'Water volume in', 'number'],
    ['basefluidvolincyl', 'Base fluid volume', 'number'],
    ['wtcylwaterbf', 'Wt. cylinder + water/BF', 'number'],
    ['massofcutting', 'Mass of wet cuttings', 'number'],
    ['massofdry', 'Mass of dry cuttings', 'number'],
    ['wtofwaterbf', 'Weight water/BF', 'number'],
    ['massofbf', 'Mass of base fluid', 'number'],
    ['mudoncutting', 'Mud on cuttings', 'number'],
    ['percofcutting', '% cuttings discharged', 'number'],
    ['volbfoildisc', 'BF/oil discharged', 'number'],
    ['volmuddisc', 'Mud discharged', 'number'],
    ['ooc', 'OOC', 'number']
  ];

  const groups = Object.entries(labels).map(([prefix, title]) => ({
    title,
    fields: definitions.map(([name, label, type]) => field(
      `rt_${prefix}_${name}`,
      label,
      type,
      calculated.has(name) ? { calculated: true } : {}
    ))
  }));

  groups.push({
    title: 'Recovery totals',
    fields: [
      field('oil_recovered', 'Oil recovered', 'number', { calculated: true }),
      field('mud_recovered', 'Mud recovered', 'number', { calculated: true }),
      field('cum_oil', 'Cumulative oil', 'number'),
      field('cum_mud', 'Cumulative mud', 'number')
    ]
  });

  groups.push({
    title: 'Volume control / finalize',
    source: 'additional',
    fields: [
      field('vctodryer_bbls', 'To dryer (bbls)', 'number', { calculated: true }),
      field('vctodryer_m3', 'To dryer (m³)', 'number', { calculated: true }),
      field('vcfrdryer_bbls', 'From dryer (bbls)', 'number', { calculated: true }),
      field('vcfrdryer_m3', 'From dryer (m³)', 'number', { calculated: true }),
      field('vcfrcf1_bbls', 'From CF1 (bbls)', 'number', { calculated: true }),
      field('vcfrcf1_m3', 'From CF1 (m³)', 'number', { calculated: true }),
      field('vcfrcf2_bbls', 'From CF2 (bbls)', 'number', { calculated: true }),
      field('vcfrcf2_m3', 'From CF2 (m³)', 'number', { calculated: true }),
      field('vcfrcf3_bbls', 'From CF3 (bbls)', 'number', { calculated: true }),
      field('vcfrcf3_m3', 'From CF3 (m³)', 'number', { calculated: true })
    ]
  });

  return groups;
}

const SECTION_ORDER = Object.entries(SECTION_DEFS).map(([id, def]) => ({ id, label: def.label }));

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function tableColumns(table) {
  return new Set(all(`PRAGMA table_info(${quoteIdentifier(table)})`).map(row => row.name));
}

function getContext(projectId, wellId) {
  const project = get(
    `SELECT id_project, contract, operator_name, drillingrig, wellname
     FROM projects WHERE id_project = ? LIMIT 1`,
    [projectId]
  );

  const report = get(
    `SELECT * FROM wellinfo WHERE id_wellinfo = ? AND id_project = ? LIMIT 1`,
    [wellId, projectId]
  );

  if (!project || !report) return null;
  return { project, report };
}

function normalizeValue(raw, meta) {
  if (raw === undefined) return undefined;
  const text = String(raw).trim();

  if (meta.required && text === '') {
    throw new InputError(`${meta.label} is required.`);
  }

  if (text === '') return null;

  if (meta.type === 'number') {
    const normalized = text.replaceAll(',', '');
    const value = Number(normalized);
    if (!Number.isFinite(value)) throw new InputError(`${meta.label} must be a number.`);
    if (meta.min !== undefined && value < Number(meta.min)) {
      throw new InputError(`${meta.label} must be at least ${meta.min}.`);
    }
    if (meta.max !== undefined && value > Number(meta.max)) {
      throw new InputError(`${meta.label} must be at most ${meta.max}.`);
    }
    if (meta.name === 'urut') {
      if (!Number.isInteger(value)) throw new InputError('Report number must be a whole number.');
      return Math.trunc(value);
    }
    return value;
  }

  if (meta.type === 'date') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      throw new InputError(`${meta.label} must use YYYY-MM-DD format.`);
    }
    return text;
  }

  if (meta.type === 'time') {
    if (!/^\d{2}:\d{2}$/.test(text)) {
      throw new InputError(`${meta.label} must use HH:MM format.`);
    }
    const [hours, minutes] = text.split(':').map(Number);
    if (hours > 23 || minutes > 59) throw new InputError(`${meta.label} contains an invalid time.`);
    return hours * 60 + minutes;
  }

  if (meta.type === 'select' && Array.isArray(meta.options)) {
    const allowed = meta.options.map(option =>
      option && typeof option === 'object' ? String(option.value) : String(option)
    );
    if (!allowed.includes(text)) {
      throw new InputError(`${meta.label} contains an unsupported value.`);
    }
  }

  return text.slice(0, meta.max || 255);
}

function flattenFields(section) {
  return section.groups.flatMap(group => group.fields);
}

function ensureWellRow(table, wellId) {
  const existing = get(
    `SELECT id_wellinfo FROM ${quoteIdentifier(table)} WHERE id_wellinfo = ? LIMIT 1`,
    [wellId]
  );
  if (!existing) {
    run(`INSERT INTO ${quoteIdentifier(table)} (id_wellinfo) VALUES (?)`, [wellId]);
  }
}

function updateRow(table, whereSql, whereParams, fields, body) {
  const columns = tableColumns(table);
  const assignments = [];
  const params = [];

  for (const meta of fields) {
    if (!columns.has(meta.name)) continue;
    const value = normalizeValue(body[meta.name], meta);
    if (value === undefined) continue;
    assignments.push(`${quoteIdentifier(meta.name)} = ?`);
    params.push(value);
  }

  if (columns.has('updated_at')) {
    assignments.push(`updated_at = datetime('now')`);
  }

  if (!assignments.length) return;
  run(
    `UPDATE ${quoteIdentifier(table)} SET ${assignments.join(', ')} WHERE ${whereSql}`,
    [...params, ...whereParams]
  );
}

function formDataFor(sectionId, section, wellId, report) {
  if (section.table === 'wellinfo') {
    return {
      ...report,
      urut: formatReportNumber(report.urut, '')
    };
  }

  if (section.special === 'waste') {
    const waste = get('SELECT * FROM dailywaste WHERE id_wellinfo = ? LIMIT 1', [wellId]) || {};
    const additional = get('SELECT * FROM additional WHERE id_wellinfo = ? LIMIT 1', [wellId]) || {};
    return { ...waste, ...additional };
  }

  if (section.special === 'retort') {
    const retort = get('SELECT * FROM retorts WHERE id_wellinfo = ? LIMIT 1', [wellId]) || {};
    const additional = get('SELECT * FROM additional WHERE id_wellinfo = ? LIMIT 1', [wellId]) || {};
    return { ...retort, ...additional };
  }

  return get(
    `SELECT * FROM ${quoteIdentifier(section.table)} WHERE id_wellinfo = ? LIMIT 1`,
    [wellId]
  ) || {};
}


function calculationContext(wellId) {
  return {
    details: get('SELECT * FROM details WHERE id_wellinfo = ? LIMIT 1', [wellId]) || {},
    desander: get('SELECT * FROM desanders WHERE id_wellinfo = ? LIMIT 1', [wellId]) || {},
    desilter: get('SELECT * FROM desilters WHERE id_wellinfo = ? LIMIT 1', [wellId]) || {},
    retort: get('SELECT * FROM retorts WHERE id_wellinfo = ? LIMIT 1', [wellId]) || {}
  };
}

function applySectionCalculations(sectionId, wellId, body = {}) {
  const next = { ...body };
  const context = calculationContext(wellId);

  if (sectionId === 'well') {
    return { ...next, ...calculateWellFields({ ...context.details, ...next }) };
  }

  const cfMatch = sectionId.match(/^centrifuge([123])$/);
  if (cfMatch) {
    const prefix = `cf${cfMatch[1]}`;
    const merged = { ...context.details, ...next };
    return { ...next, ...calculateCentrifuge(prefix, merged, merged.volholeunit) };
  }

  if (sectionId === 'desander' || sectionId === 'desilter') {
    const existing = sectionId === 'desander' ? context.desander : context.desilter;
    return { ...next, ...calculateSolidsControl({ ...existing, ...next }) };
  }

  if (sectionId === 'retort') {
    const additional = get('SELECT * FROM additional WHERE id_wellinfo = ? LIMIT 1', [wellId]) || {};
    return calculateRetort({ ...context.retort, ...additional, ...next }, context.details);
  }

  if (sectionId === 'waste') {
    return {
      ...next,
      ...calculateDailyWaste(context)
    };
  }

  return next;
}

function calculatedFormData(sectionId, section, wellId, report) {
  const base = formDataFor(sectionId, section, wellId, report);
  if (['well', 'centrifuge1', 'centrifuge2', 'centrifuge3', 'desander', 'desilter', 'retort', 'waste'].includes(sectionId)) {
    return { ...base, ...applySectionCalculations(sectionId, wellId, base) };
  }
  return base;
}

export function reportEditor(req, res, next) {
  try {
    const projectId = Number(req.params.projectId);
    const wellId = Number(req.params.wellId);
    const context = getContext(projectId, wellId);

    if (!context) {
      return res.status(404).render('errors/404', { title: 'Report not found' });
    }

    const requestedSection = String(req.query.section || 'report');
    const sectionId = SECTION_DEFS[requestedSection] ? requestedSection : 'report';
    const section = SECTION_DEFS[sectionId];
    const data = calculatedFormData(sectionId, section, wellId, context.report);

    res.render('reports/edit', {
      title: `Edit report ${formatReportNumber(context.report.urut, context.report.id_wellinfo)}`,
      project: context.project,
      report: context.report,
      sectionId,
      section,
      sections: SECTION_ORDER,
      data,
      calcContext: calculationContext(wellId),
      activeMudMeta: activeMudCategoryMeta(data),
      reportSettings: getReportSettings(),
      canEdit: isReportManager(req.user) || String(context.report.validation_status || 'DRAFT') !== 'VALIDATED',
      isManager: isReportManager(req.user),
      notice: String(req.query.notice || '').slice(0, 300),
      error: null
    });
  } catch (error) {
    next(error);
  }
}

export function saveReportSection(req, res, next) {
  try {
    const projectId = Number(req.params.projectId);
    const wellId = Number(req.params.wellId);
    const sectionId = String(req.params.section || '');
    const section = SECTION_DEFS[sectionId];
    const context = getContext(projectId, wellId);

    if (!context || !section) {
      return res.status(404).render('errors/404', { title: 'Report section not found' });
    }

    if (!isReportManager(req.user) && String(context.report.validation_status || 'DRAFT') === 'VALIDATED') {
      throw new InputError('This report is validated. A Supervisor or Admin must re-open it before an Operator can edit it.', 423);
    }

    const calculatedBody = applySectionCalculations(sectionId, wellId, req.body);

    transaction(() => {
      if (section.table === 'wellinfo') {
        updateRow(
          'wellinfo',
          'id_wellinfo = ? AND id_project = ?',
          [wellId, projectId],
          flattenFields(section),
          calculatedBody
        );
        return;
      }

      if (section.special === 'waste') {
        ensureWellRow('dailywaste', wellId);
        ensureWellRow('additional', wellId);
        updateRow(
          'dailywaste',
          'id_wellinfo = ?',
          [wellId],
          section.groups[0].fields,
          calculatedBody
        );
        updateRow(
          'additional',
          'id_wellinfo = ?',
          [wellId],
          section.groups[1].fields,
          calculatedBody
        );
        return;
      }

      if (section.special === 'retort') {
        ensureWellRow('retorts', wellId);
        ensureWellRow('additional', wellId);
        const retortFields = section.groups
          .filter(group => group.source !== 'additional')
          .flatMap(group => group.fields);
        const additionalFields = section.groups
          .filter(group => group.source === 'additional')
          .flatMap(group => group.fields);
        updateRow('retorts', 'id_wellinfo = ?', [wellId], retortFields, calculatedBody);
        updateRow('additional', 'id_wellinfo = ?', [wellId], additionalFields, calculatedBody);
        return;
      }

      ensureWellRow(section.table, wellId);
      updateRow(section.table, 'id_wellinfo = ?', [wellId], flattenFields(section), calculatedBody);
    });

    if (new Set([
      'well', 'amp', 'centrifuge1', 'centrifuge2', 'centrifuge3',
      'desander', 'desilter', 'retort'
    ]).has(sectionId)) {
      recalculateReportDerivedFields(wellId);
    }

    const workflowState = markReportSaved(wellId, req.user);

    res.redirect(
      `/projects/${projectId}/reports/${wellId}/edit?section=${encodeURIComponent(sectionId)}` +
      '&notice=' + encodeURIComponent(`${section.label} saved. ${workflowState === 'PENDING' ? 'Saved. Editing remains open until Supervisor/Admin validates for handover.' : 'Validated automatically.'}`)
    );
  } catch (error) {
    if (error instanceof InputError) {
      const projectId = Number(req.params.projectId);
      const wellId = Number(req.params.wellId);
      const sectionId = String(req.params.section || 'report');
      const section = SECTION_DEFS[sectionId] || SECTION_DEFS.report;
      const context = getContext(projectId, wellId);
      if (!context) return next(error);

      return res.status(error.status).render('reports/edit', {
        title: `Edit report ${formatReportNumber(context.report.urut, context.report.id_wellinfo)}`,
        project: context.project,
        report: context.report,
        sectionId,
        section,
        sections: SECTION_ORDER,
        data: { ...calculatedFormData(sectionId, section, wellId, context.report), ...req.body },
        calcContext: calculationContext(wellId),
        activeMudMeta: activeMudCategoryMeta({ ...calculationContext(wellId).details, ...req.body }),
        reportSettings: getReportSettings(),
        canEdit: isReportManager(req.user) || String(context.report.validation_status || 'DRAFT') !== 'VALIDATED',
        isManager: isReportManager(req.user),
        notice: '',
        error: error.message
      });
    }
    next(error);
  }
}

export function recalculateReport(req, res, next) {
  try {
    const projectId = Number(req.params.projectId);
    const wellId = Number(req.params.wellId);
    const context = getContext(projectId, wellId);

    if (!context) {
      return res.status(404).render('errors/404', { title: 'Report not found' });
    }

    if (!isReportManager(req.user) && String(context.report.validation_status || 'DRAFT') === 'VALIDATED') {
      throw new InputError('This report is validated. A Supervisor or Admin must re-open it before recalculation.', 423);
    }

    recalculateReportDerivedFields(wellId);
    const workflowState = markReportSaved(wellId, req.user);
    res.redirect(
      `/projects/${projectId}/reports/${wellId}?notice=` +
      encodeURIComponent(`All derived report formulas recalculated. ${workflowState === 'PENDING' ? 'Saved. Editing remains open until Supervisor/Admin validates for handover.' : 'Validated automatically.'}`)
    );
  } catch (error) {
    if (error instanceof InputError) {
      return res.status(error.status).send(error.message);
    }
    next(error);
  }
}


function cloneWellChild(table, sourceWellId, targetWellId) {
  const columns = all(`PRAGMA table_info(${quoteIdentifier(table)})`);
  if (!columns.length) return;

  const row = get(
    `SELECT * FROM ${quoteIdentifier(table)} WHERE id_wellinfo = ? LIMIT 1`,
    [sourceWellId]
  );
  if (!row) {
    if (columns.some(column => column.name === 'id_wellinfo')) {
      run(`INSERT INTO ${quoteIdentifier(table)} (id_wellinfo) VALUES (?)`, [targetWellId]);
    }
    return;
  }

  const primaryKeyNames = new Set(columns.filter(column => Number(column.pk) > 0).map(column => column.name));
  const insertColumns = [];
  const values = [];

  for (const column of columns) {
    if (primaryKeyNames.has(column.name) && column.name !== 'id_wellinfo') continue;
    if (column.name === 'id_wellinfo') {
      insertColumns.push(column.name);
      values.push(targetWellId);
      continue;
    }
    if (column.name === 'created_at' || column.name === 'updated_at') {
      insertColumns.push(column.name);
      values.push(new Date().toISOString().replace('T', ' ').slice(0, 19));
      continue;
    }
    insertColumns.push(column.name);
    values.push(row[column.name] ?? null);
  }

  const placeholders = insertColumns.map(() => '?').join(', ');
  run(
    `INSERT INTO ${quoteIdentifier(table)} (${insertColumns.map(quoteIdentifier).join(', ')})
     VALUES (${placeholders})`,
    values
  );
}

function createReportFromSource(projectId, sourceReport, sourceWellId, user) {
  return transaction(() => {
    const projectMax = Number(get(
      `SELECT COALESCE(MAX(CAST(urut AS INTEGER)), 0) AS max_no
       FROM wellinfo WHERE id_project = ?`,
      [projectId]
    )?.max_no ?? 0);
    const nextNumber = nextReportNumber(sourceReport.urut, projectMax);
    const date = nextReportDate(sourceReport.curdate) || todayLocal();
    const workflow = workflowForNewReport(user);

    const result = run(
      `INSERT INTO wellinfo
       (curdate, id_project, platform, wellname, spud_date, location, companyman, oim, mudeng, urut,
        lockreport, validation_status, created_by_user_id, submitted_at, validated_by_user_id, validated_at,
        created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        date, projectId, sourceReport.platform, sourceReport.wellname, sourceReport.spud_date,
        sourceReport.location, sourceReport.companyman, sourceReport.oim, sourceReport.mudeng, nextNumber,
        workflow.lockreport, workflow.validationStatus, Number(user.id_user),
        workflow.validationStatus === 'VALIDATED' ? new Date().toISOString().replace('T', ' ').slice(0, 19) : null,
        workflow.validatedBy,
        workflow.validationStatus === 'VALIDATED' ? new Date().toISOString().replace('T', ' ').slice(0, 19) : null
      ]
    );

    const targetWellId = Number(result.lastInsertRowid);
    for (const table of REPORT_TABLES) cloneWellChild(table, sourceWellId, targetWellId);
    const detailColumns = tableColumns('details');
    if (detailColumns.has('datenow')) {
      run(`UPDATE details SET datenow = ?, updated_at = datetime('now') WHERE id_wellinfo = ?`, [date, targetWellId]);
    }
    return targetWellId;
  });
}

export function createNextReport(req, res, next) {
  try {
    const projectId = Number(req.params.projectId);
    const source = get(
      `SELECT * FROM wellinfo WHERE id_project = ?
       ORDER BY CAST(urut AS INTEGER) DESC, curdate DESC, id_wellinfo DESC LIMIT 1`,
      [projectId]
    );
    if (!source) return res.status(404).render('errors/404', { title: 'No source report found' });
    const newWellId = createReportFromSource(projectId, source, Number(source.id_wellinfo), req.user);
    recalculateReportDerivedFields(newWellId);
    const notice = encodeURIComponent(
      isReportManager(req.user)
        ? 'Next report created and validated automatically.'
        : 'Next report created. Operators can edit until Supervisor/Admin validates it for handover.'
    );
    const target = isReportManager(req.user)
      ? `/projects/${projectId}/reports/${newWellId}?notice=${notice}`
      : `/projects/${projectId}/reports/${newWellId}/edit?section=report&notice=${notice}`;
    res.redirect(target);
  } catch (error) { next(error); }
}

export function copyReport(req, res, next) {
  try {
    const projectId = Number(req.params.projectId);
    const sourceWellId = Number(req.params.wellId);
    const context = getContext(projectId, sourceWellId);
    if (!context) return res.status(404).render('errors/404', { title: 'Report not found' });
    const newWellId = createReportFromSource(projectId, context.report, sourceWellId, req.user);
    recalculateReportDerivedFields(newWellId);
    res.redirect(
      `/projects/${projectId}/reports/${newWellId}/edit?section=report&notice=` +
      encodeURIComponent(isReportManager(req.user)
        ? 'Report copied and validated automatically.'
        : 'Report copied. Operators can edit until Supervisor/Admin validates it for handover.')
    );
  } catch (error) { next(error); }
}

export function validateReportAction(req, res, next) {
  try {
    const projectId = Number(req.params.projectId);
    const wellId = Number(req.params.wellId);
    validateReport(wellId, req.user);
    res.redirect(`/projects/${projectId}/reports/${wellId}?notice=` + encodeURIComponent('Report validated for handover. Operator viewing/PDF access remains available; Operator editing is now frozen.'));
  } catch (error) { next(error); }
}

export function reopenReportAction(req, res, next) {
  try {
    const projectId = Number(req.params.projectId);
    const wellId = Number(req.params.wellId);
    reopenReport(wellId, req.user);
    res.redirect(`/projects/${projectId}/reports/${wellId}?notice=` + encodeURIComponent('Report re-opened. Operator editing is available again until the next handover validation.'));
  } catch (error) { next(error); }
}

export function deleteReport(req, res, next) {
  try {
    const projectId = Number(req.params.projectId);
    const wellId = Number(req.params.wellId);
    const context = getContext(projectId, wellId);
    if (!context) {
      return res.status(404).render('errors/404', { title: 'Report not found' });
    }

    if (!MANAGER_LEVELS.has(req.user.level)) {
      return res.status(403).render('errors/403', { title: 'Access denied' });
    }

    const total = Number(get(
      'SELECT COUNT(*) AS total FROM wellinfo WHERE id_project = ?',
      [projectId]
    )?.total ?? 0);

    if (total <= 1) {
      return res.redirect(`/projects/${projectId}/reports?notice=` + encodeURIComponent(
        'The only report in a project cannot be deleted.'
      ));
    }

    deleteReportTree(wellId, projectId);

    res.redirect(`/projects/${projectId}/reports?notice=` + encodeURIComponent('Report deleted.'));
  } catch (error) {
    next(error);
  }
}
