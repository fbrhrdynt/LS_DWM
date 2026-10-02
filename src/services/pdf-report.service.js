import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import { getReportSettings, buildReportTitle } from './report-settings.service.js';
import { formatReportNumber } from './report-sequence.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

let GREEN = '#267544';
const WHITE = '#ffffff';
const BLACK = '#111111';
const GREY = '#666666';
const BORDER = '#999999';

const PAGE = {
  size: 'A4',
  layout: 'portrait',
  margin: 10
};

function val(value, fallback = '-') {
  return value === null || value === undefined || value === '' ? fallback : String(value);
}

function plain(value, fallback = '') {
  return value === null || value === undefined || value === '' ? fallback : String(value);
}

function withUnit(value, unit, fallback = '') {
  const v = plain(value, '');
  const u = plain(unit, '');
  const text = [v, u].filter(Boolean).join(' ').trim();
  return text || fallback;
}

function numeric(value, fallback = 0) {
  const n = Number(String(value ?? '').replaceAll(',', ''));
  return Number.isFinite(n) ? n : fallback;
}

function fluidType(code) {
  if (code === null || code === undefined || code === '') return '';
  return ({
    'WB-SW': 'Sea Water',
    'WB-WB': 'Water Base',
    'WB-WBH': 'Water Base HPWBM',
    'OBM-LT': 'LT-Oil Base',
    'OBM-SB': 'Synthetic Base',
    'OBM-EN': 'Enviromul'
  })[code] || plain(code);
}

function fluidCategoryLabels(code) {
  const water = ['WB-SW', 'WB-WB', 'WB-WBH'].includes(code);
  return water
    ? { left: 'MBT (lb/bbl)', right: '% Base Fluid' }
    : { left: 'E-Stability (Volt)', right: 'Oil / Water Ratio' };
}

function dateText(value) {
  if (!value) return '';
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return String(value);
  const [, year, month, day] = match;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${day}-${months[Number(month) - 1] || month}-${year}`;
}

function sampleTime(value) {
  if (value === null || value === undefined || value === '') return '-';

  const text = String(value).trim();
  if (/^\d{1,2}:\d{2}$/.test(text)) return text;

  const minutes = Number(text);
  if (Number.isFinite(minutes)) {
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(Math.round(minutes % 60)).padStart(2, '0')}`;
  }

  return text;
}

function pctWidths(totalWidth, percentages) {
  return percentages.map(p => totalWidth * (p / 100));
}

function fitText(doc, text, width, height, options = {}) {
  const font = options.bold ? 'Helvetica-Bold' : 'Helvetica';
  let size = options.fontSize || 5.35;
  const min = options.minFontSize || 3.6;
  const content = val(text, options.fallback ?? '-');
  const availableWidth = Math.max(1, width);
  const availableHeight = Math.max(1, height);

  const fits = () => {
    doc.font(font).fontSize(size);
    const measuredHeight = doc.heightOfString(content, {
      width: availableWidth,
      align: options.align || 'left',
      lineGap: 0
    });
    return measuredHeight <= availableHeight + 0.15;
  };

  // The caller already removes cell padding before reaching this function.
  // Do not subtract padding again; doing so caused labels to become S… / B… / M….
  while (size > min && !fits()) {
    size = Math.max(min, size - 0.15);
  }

  doc.font(font).fontSize(size);
  return content;
}

function cell(doc, x, y, width, height, text, options = {}) {
  if (options.fill) {
    doc.save().rect(x, y, width, height).fill(options.fill).restore();
  }

  if (options.border !== false) {
    doc.save()
      .lineWidth(options.lineWidth || 0.35)
      .strokeColor(options.borderColor || BORDER)
      .rect(x, y, width, height)
      .stroke()
      .restore();
  }

  const padX = options.padX ?? 2;
  const padY = options.padY ?? 1.25;
  const availableWidth = Math.max(1, width - padX * 2);
  const availableHeight = Math.max(1, height - padY * 2);
  const content = fitText(doc, text, availableWidth, availableHeight, options);

  // Clip strictly to the current cell, but never auto-ellipsize labels/values.
  // fitText reduces the font size until the complete text fits the row.
  doc.save();
  doc.rect(x + 0.25, y + 0.25, Math.max(0.5, width - 0.5), Math.max(0.5, height - 0.5)).clip();
  doc.fillColor(options.color || BLACK)
    .font(options.bold ? 'Helvetica-Bold' : 'Helvetica')
    .text(
      content,
      x + padX,
      y + padY,
      {
        width: availableWidth,
        height: availableHeight,
        align: options.align || 'left',
        lineGap: 0,
        ellipsis: false
      }
    );
  doc.restore();
}


function labelUnitCell(doc, x, y, width, height, label, unit = '', options = {}) {
  if (options.fill) {
    doc.save().rect(x, y, width, height).fill(options.fill).restore();
  }

  if (options.border !== false) {
    doc.save()
      .lineWidth(options.lineWidth || 0.35)
      .strokeColor(options.borderColor || BORDER)
      .rect(x, y, width, height)
      .stroke()
      .restore();
  }

  const cleanUnit = plain(unit, '');
  const unitWidth = cleanUnit ? Math.min(40, Math.max(24, width * 0.27)) : 0;
  const labelWidth = Math.max(1, width - unitWidth - 6);
  const fontSize = options.fontSize || 4.75;
  const minFontSize = options.minFontSize || 3.75;

  doc.save();
  doc.rect(x + 0.25, y + 0.25, Math.max(0.5, width - 0.5), Math.max(0.5, height - 0.5)).clip();

  const labelText = fitText(doc, plain(label), labelWidth, height - 2.2, {
    fontSize,
    minFontSize,
    bold: options.bold,
    align: 'left',
    fallback: ''
  });
  doc.fillColor(options.color || BLACK)
    .font(options.bold ? 'Helvetica-Bold' : 'Helvetica')
    .text(labelText, x + 2, y + 1.2, {
      width: labelWidth,
      height: height - 2.2,
      align: 'left',
      lineGap: 0,
      ellipsis: false
    });

  if (cleanUnit) {
    doc.font('Helvetica').fontSize(Math.max(3.7, fontSize - 0.15))
      .text(cleanUnit, x + width - unitWidth - 2, y + 1.2, {
        width: unitWidth,
        height: height - 2.2,
        align: 'right',
        lineGap: 0,
        ellipsis: false
      });
  }

  doc.restore();
}

function row(doc, x, y, totalWidth, cells, options = {}) {
  const height = options.height || 10;
  let cx = x;

  for (const item of cells) {
    const width = item.widthPct !== undefined
      ? totalWidth * (item.widthPct / 100)
      : item.width;

    const cellOptions = {
      align: item.align,
      bold: item.bold,
      fill: item.fill,
      color: item.color,
      fontSize: item.fontSize || options.fontSize,
      minFontSize: item.minFontSize || options.minFontSize,
      border: item.border,
      lineWidth: item.lineWidth,
      padX: item.padX,
      padY: item.padY,
      ellipsis: item.ellipsis
    };

    if (Object.hasOwn(item, 'unit')) {
      labelUnitCell(doc, cx, y, width, item.height || height, item.text, item.unit, cellOptions);
    } else {
      cell(doc, cx, y, width, item.height || height, item.text, cellOptions);
    }
    cx += width;
  }

  return y + height;
}

function greenCell(text, widthPct, extra = {}) {
  return {
    text,
    widthPct,
    fill: GREEN,
    color: WHITE,
    bold: true,
    align: extra.align || 'center',
    fontSize: extra.fontSize || 5.4,
    ...extra
  };
}

function textCell(text, widthPct, extra = {}) {
  return { text, widthPct, ...extra };
}

function tryImage(doc, candidates, x, y, width, height) {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const file = path.isAbsolute(candidate) ? candidate : path.join(rootDir, candidate);
    try {
      if (fs.existsSync(file) && fs.statSync(file).isFile()) {
        doc.image(file, x, y, {
          fit: [width, height],
          align: 'center',
          valign: 'center'
        });
        return true;
      }
    } catch {}
  }
  return false;
}


function storedUploadCandidate(relativePath) {
  if (!relativePath) return null;
  const normalized = String(relativePath).replaceAll('\\', '/').replace(/^\/+/, '');
  const root = path.resolve(rootDir, 'storage', 'uploads');
  const absolute = path.resolve(root, normalized);
  if (absolute !== root && !absolute.startsWith(root + path.sep)) return null;
  return absolute;
}

function logoCandidates(value, preferredFolder = '') {
  if (!value) return [];

  let raw = String(value).trim().replaceAll('\\', '/');
  if (!raw) return [];

  try {
    if (/^https?:\/\//i.test(raw)) raw = new URL(raw).pathname;
  } catch {}

  const noQuery = raw.split('?')[0].split('#')[0];
  const normalized = noQuery.replace(/^\/+/, '');
  const withoutStorage = normalized.replace(/^storage\//, '');
  const withoutUploads = withoutStorage.replace(/^uploads\//, '');
  const basename = path.basename(normalized);

  return [
    storedUploadCandidate(normalized),
    storedUploadCandidate(withoutStorage),
    storedUploadCandidate(withoutUploads),
    preferredFolder && storedUploadCandidate(`${preferredFolder}/${basename}`),
    path.resolve(rootDir, normalized),
    path.resolve(rootDir, 'storage', 'uploads', withoutUploads),
    path.resolve(rootDir, 'storage', 'app', 'public', withoutStorage),
    path.resolve(rootDir, 'public', 'storage', withoutStorage),
    path.resolve(rootDir, 'public', 'isi', 'logos', basename),
    path.resolve(rootDir, 'public', 'logos', basename)
  ].filter(Boolean);
}

function tryImageCentered(doc, candidates, boxX, boxY, boxWidth, boxHeight, maxWidth, maxHeight) {
  const targetWidth = Math.min(boxWidth, maxWidth || boxWidth);
  const targetHeight = Math.min(boxHeight, maxHeight || boxHeight);
  const x = boxX + (boxWidth - targetWidth) / 2;
  const y = boxY + (boxHeight - targetHeight) / 2;
  return tryImage(doc, candidates, x, y, targetWidth, targetHeight);
}

function drawHeader(doc, data, x, y, width) {
  const { project, report } = data;
  const settings = data.reportSettings || getReportSettings();
  const reportNo = formatReportNumber(report.urut, report.id_wellinfo);
  const title = buildReportTitle(settings, reportNo);

  const leftW = width * 0.25;
  const centerW = width * 0.50;
  const rightW = width * 0.25;
  const h = 47;

  const companyLogo = tryImageCentered(doc, [
    ...logoCandidates(settings.company_logo, 'branding'),
    process.env.DWM_REPORT_LOGO,
    'public/stepoil_logo.jpeg'
  ], x, y, leftW, h, 118, 36);

  if (!companyLogo) {
    doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(10)
      .text('OUR COMPANY', x + 5, y + 17, { width: leftW - 10, align: 'center' });
  }

  doc.fillColor(BLACK).font('Helvetica-Bold').fontSize(13.5)
    .text(title, x + leftW, y + 4, {
      width: centerW,
      align: 'center',
      height: 17,
      ellipsis: true
    });

  doc.font('Helvetica').fontSize(7.2)
    .text(val(settings.company_header_line_1, ''), x + leftW, y + 22, {
      width: centerW,
      align: 'center',
      height: 9,
      ellipsis: true
    })
    .text(val(settings.company_header_line_2, ''), x + leftW, y + 31, {
      width: centerW,
      align: 'center',
      height: 9,
      ellipsis: true
    });

  const projectLogoName = project.logo ? String(project.logo) : '';
  const projectLogo = tryImageCentered(doc, [
    ...logoCandidates(projectLogoName, 'project-logos')
  ], x + leftW + centerW, y, rightW, h, 96, 38);

  if (!projectLogo) {
    doc.fillColor(BLACK).font('Helvetica-Bold').fontSize(7)
      .text(val(project.operator_name), x + leftW + centerW + 5, y + 18, {
        width: rightW - 10,
        align: 'center',
        ellipsis: true
      });
  }

  return y + h + 7;
}

function drawWellInfo(doc, data, x, y, width) {
  const { project, report, details } = data;
  const rows = [
    ['Operator', plain(project.operator_name), 'Depth (ft)', withUnit(details.curdepth, 'feet'), 'Date', dateText(report.curdate)],
    ['Well Name', plain(report.wellname), 'Depth 1 Day Before', withUnit(details.depth1bef, 'feet'), 'Spud-in Date', dateText(report.spud_date)],
    ['Location', plain(report.location), '% Washout', withUnit(details.washout, '%'), 'Bit Size (inch)', plain(details.bitsize)],
    ['Operator Rep', plain(report.companyman), 'Vol Hole Drilled', withUnit(details.volholedrill, plain(details.volholeunit)), 'Bit Type', plain(details.bittype)],
    ['Contractor Rep', plain(report.oim), 'Fluids Type', fluidType(details.fluidtype), 'Avg. ROP for Drlg Hrs', plain(details.avgrop)],
    ['Drilling Rig', plain(project.drillingrig), 'Activity', plain(details.rigpresentact), 'Circulating Rate', withUnit(details.cirrategpm, 'gpm')]
  ];

  for (const r of rows) {
    y = row(doc, x, y, width, [
      textCell(r[0], 12, { align: 'right', bold: true, border: false }),
      textCell(`: ${r[1]}`, 20, { border: false }),
      textCell(r[2], 16, { align: 'right', bold: true, border: false }),
      textCell(`: ${r[3]}`, 18, { border: false }),
      textCell(r[4], 14, { align: 'right', bold: true, border: false }),
      textCell(`: ${r[5]}`, 20, { border: false })
    ], { height: 11, fontSize: 5.55, minFontSize: 4.8 });
  }

  return y + 1;
}

function drawActiveMud(doc, data, x, y, width) {
  const d = data.details;
  const labels = fluidCategoryLabels(d.fluidtype);
  const water = ['WB-SW', 'WB-WB', 'WB-WBH'].includes(d.fluidtype);
  const result1 = water ? d.categories2 : d.categories1;
  const result2 = water ? d.basefluid : d.categories2;

  y = row(doc, x, y, width, [
    greenCell('A C T I V E   M U D   P R O P E R T I E S', 100, { fontSize: 6.2, border: false })
  ], { height: 12 });

  const rows = [
    ['Mud Weight', withUnit(d.mudweight, plain(d.mwunit)), '% LGS', plain(d.lgsactive), 'PV', withUnit(d.pv, 'cps'), 'YP', withUnit(d.yp, 'lbs/100 ft2'), labels.left, plain(result1)],
    ['Mud Temp.', withUnit(d.mudtemp, d.tempunit === 'degc' ? 'C' : d.tempunit === 'degf' ? 'F' : plain(d.tempunit)), '% HGS', plain(d.hgsactive), 'Sand Cont', plain(d.sandcontent), 'Chlorides', withUnit(d.chlorides, 'mg/L'), labels.right, water ? withUnit(result2, '%') : plain(result2)]
  ];

  for (const r of rows) {
    const cells = [];
    for (let i = 0; i < r.length; i += 2) {
      cells.push(textCell(r[i], 10, { align: 'right', border: false, bold: true }));
      cells.push(textCell(`: ${plain(r[i + 1])}`, 10, { border: false }));
    }
    y = row(doc, x, y, width, cells, { height: 10.5, fontSize: 5.15, minFontSize: 4.6 });
  }

  return y + 1;
}

function drawEquipment(doc, data, x, y, width) {
  const d = data.details;
  const ds = data.desander;
  const di = data.desilter;

  {
    const h = 10;
    const widths = pctWidths(width, [24.2, 9.2, 9.2, 10, 10, 15, 15, 7.4]);
    let cx = x;

    cell(doc, cx, y, widths[0], h * 2, 'C E N T R I F U G E S', {
      fill: GREEN, color: WHITE, bold: true, align: 'center', fontSize: 5.6
    });
    cx += widths[0];

    cell(doc, cx, y, widths[1], h, 'Centrifuge 1', { fill: GREEN, color: WHITE, bold: true, align: 'center', fontSize: 5.2 });
    cell(doc, cx, y + h, widths[1], h, d.cf1_sn, { fill: GREEN, color: WHITE, bold: true, align: 'center', fontSize: 5.0 });
    cx += widths[1];

    cell(doc, cx, y, widths[2], h, 'Centrifuge 2', { fill: GREEN, color: WHITE, bold: true, align: 'center', fontSize: 5.2 });
    cell(doc, cx, y + h, widths[2], h, d.cf2_sn, { fill: GREEN, color: WHITE, bold: true, align: 'center', fontSize: 5.0 });
    cx += widths[2];

    cell(doc, cx, y, widths[3], h, 'Centrifuge 3', { fill: GREEN, color: WHITE, bold: true, align: 'center', fontSize: 5.2 });
    cell(doc, cx, y + h, widths[3], h, d.cf3_sn, { fill: GREEN, color: WHITE, bold: true, align: 'center', fontSize: 5.0 });
    cx += widths[3];

    const shakerGroupW = widths[4] + widths[5] + widths[6];
    cell(doc, cx, y, shakerGroupW, h, 'SHALE SHAKERS & SCREENS', {
      fill: GREEN, color: WHITE, bold: true, align: 'center', fontSize: 5.25
    });
    cell(doc, cx, y + h, widths[4], h, 'Shakers', { fill: GREEN, color: WHITE, bold: true, align: 'center', fontSize: 5.0 });
    cell(doc, cx + widths[4], y + h, widths[5], h, 'Model (Type)', { fill: GREEN, color: WHITE, bold: true, align: 'center', fontSize: 5.0 });
    cell(doc, cx + widths[4] + widths[5], y + h, widths[6], h, 'Screen Size', { fill: GREEN, color: WHITE, bold: true, align: 'center', fontSize: 5.0 });
    cx += shakerGroupW;

    cell(doc, cx, y, widths[7], h * 2, 'Running\nHrs', {
      fill: GREEN, color: WHITE, bold: true, align: 'center', fontSize: 4.9
    });

    y += h * 2;
  }

  const shakerRows = [
    ['Serial Number', '', d.cf1_sn, d.cf2_sn, d.cf3_sn, d.sh1_name, d.sh1_model, d.sh1_screensize, d.sh1_runninghour],
    ['Mode of Operation', '', d.cf1_modeofopr, d.cf2_modeofopr, d.cf3_modeofopr, d.sh2_name, d.sh2_model, d.sh2_screensize, d.sh2_runninghour],
    ['Bowl-Conveyor Wear Reading', '(mm)', d.cf1_weirplate, d.cf2_weirplate, d.cf3_weirplate, d.sh3_name, d.sh3_model, d.sh3_screensize, d.sh3_runninghour],
    ['Bowl Speed', '(rpm)', d.cf1_bowlspeed, d.cf2_bowlspeed, d.cf3_bowlspeed, d.sh4_name, d.sh4_model, d.sh4_screensize, d.sh4_runninghour],
    ['Bowl-Conveyor Differential Speed', '(rpm)', d.cf1_bowlconv, d.cf2_bowlconv, d.cf3_bowlconv, d.sh5_name, d.sh5_model, d.sh5_screensize, d.sh5_runninghour],
    ['Feed-in Suction from', '', d.cf1_feedsuc, d.cf2_feedsuc, d.cf3_feedsuc, d.sh6_name, d.sh6_model, d.sh6_screensize, d.sh6_runninghour]
  ];

  for (const r of shakerRows) {
    y = row(doc, x, y, width, [
      textCell(r[0], 24, { unit: plain(r[1]), minFontSize: 3.8 }),
      textCell(r[2], 9, { align: 'center' }),
      textCell(r[3], 9.5, { align: 'center' }),
      textCell(r[4], 10, { align: 'center' }),
      textCell(r[5], 10, { align: 'center' }),
      textCell(r[6], 15, { align: 'center' }),
      textCell(r[7], 15, { align: 'center' }),
      textCell(r[8], 7.5, { align: 'center' })
    ], { height: 9.4, fontSize: 4.85, minFontSize: 3.8 });
  }

  y = row(doc, x, y, width, [
    textCell('Effluent Return to', 24, { unit: '' }),
    textCell(d.cf1_effluentreturn, 9, { align: 'center' }),
    textCell(d.cf2_effluentreturn, 9.5, { align: 'center' }),
    textCell(d.cf3_effluentreturn, 10, { align: 'center' }),
    textCell('Screens Changed', 10, { align: 'center', fontSize: 4.4 }),
    textCell(d.screens_changed, 37.5, { align: 'left', minFontSize: 3.8 })
  ], { height: 9.4, fontSize: 4.85, minFontSize: 3.8 });

  y = row(doc, x, y, width, [
    textCell('Underflow Discharge to', 24, { unit: '' }),
    textCell(d.cf1_underflow, 9, { align: 'center' }),
    textCell(d.cf2_underflow, 9.5, { align: 'center' }),
    textCell(d.cf3_underflow, 10, { align: 'center' }),
    greenCell('DESANDER', 23),
    greenCell('DESILTER', 24.5)
  ], { height: 10, fontSize: 4.9 });

  const combined = [
    ['Running Hours', '(hrs)', d.cf1_runninghour, d.cf2_runninghour, d.cf3_runninghour, 'Running Hours', ds.run_hour, 'Running Hours', di.run_hour],
    ['Feed-in Rate (Flow Rate)', '(gal/min)', d.cf1_feedinrate, d.cf2_feedinrate, d.cf3_feedinrate, 'Feed Rate (gal/min)', ds.feed_rate, 'Feed Rate (gal/min)', di.feed_rate],
    ['Feed-in Density (WT In)', plain(d.mwunit) ? `(${plain(d.mwunit)})` : '', d.cf1_feedindensity, d.cf2_feedindensity, d.cf3_feedindensity, 'Feed Density', ds.feed_dens, 'Feed Density', di.feed_dens],
    ['Centrate Density (WT Out)', plain(d.mwunit) ? `(${plain(d.mwunit)})` : '', d.cf1_centratedens, d.cf2_centratedens, d.cf3_centratedens, 'Overflow Density', ds.overflow_dens, 'Overflow Density', di.overflow_dens],
    ['Cake Discard Density (Discard WT)', plain(d.mwunit) ? `(${plain(d.mwunit)})` : '', d.cf1_cakediscdens, d.cf2_cakediscdens, d.cf3_cakediscdens, 'Underflow Density', ds.underflow_dens, 'Underflow Density', di.underflow_dens],
    ['Centrate Return Rate', '(gal/min)', d.cf1_centratereturn, d.cf2_centratereturn, d.cf3_centratereturn, 'Vol Discharge (bbls)', ds.vol_discharge, 'Vol Discharge (bbls)', di.vol_discharge],
    ['Cake Discard Flow Rate', '(gal/min)', d.cf1_cakediscflow, d.cf2_cakediscflow, d.cf3_cakediscflow, 'Mud-on-Cuttings', ds.mudoncuttings, 'Mud-on-Cuttings', di.mudoncuttings],
    ['Mass Cake Discharge', '(kg)', d.cf1_masscake, d.cf2_masscake, d.cf3_masscake, 'Vol Mud Discharge (bbls)', ds.volmud_discharge, 'Vol Mud Discharge (bbls)', di.volmud_discharge],
    ['Volume Cake Discharge', plain(d.volholeunit) ? `(${plain(d.volholeunit)})` : '', d.cf1_volcake, d.cf2_volcake, d.cf3_volcake, 'Head Pressure (psi)', ds.head_pressure, 'Head Pressure (psi)', di.head_pressure]
  ];

  for (const r of combined) {
    y = row(doc, x, y, width, [
      textCell(r[0], 24, { unit: plain(r[1]), minFontSize: 3.7 }),
      textCell(r[2], 9, { align: 'center' }),
      textCell(r[3], 9.5, { align: 'center' }),
      textCell(r[4], 10, { align: 'center' }),
      textCell(r[5], 15, { fontSize: 4.4 }),
      textCell(r[6], 8, { align: 'center' }),
      textCell(r[7], 15, { fontSize: 4.4 }),
      textCell(r[8], 9.5, { align: 'center' })
    ], { height: 9.35, fontSize: 4.75, minFontSize: 3.7 });
  }

  return y;
}

function drawOocChart(doc, retort, x, y, width, height) {
  cell(doc, x, y, width, height, '', { border: true });

  const labels = ['Shakers', 'Dryer', "C'fuge 1", "C'fuge 2", "C'fuge 3"];
  const values = [
    numeric(retort.rt_sh_ooc),
    numeric(retort.rt_cdu_ooc),
    numeric(retort.rt_cf1_ooc),
    numeric(retort.rt_cf2_ooc),
    numeric(retort.rt_cf3_ooc)
  ].map(v => Math.max(0, v));

  const maximum = Math.max(...values, 0);
  let tickStep;
  if (maximum <= 20) tickStep = 2;
  else if (maximum <= 50) tickStep = 5;
  else tickStep = 10;

  const yMax = maximum <= 0
    ? 10
    : Math.max(tickStep, Math.ceil(maximum / tickStep) * tickStep);

  const chartX = x + 15;
  const chartY = y + 18;
  const chartW = width - 24;
  const chartH = height - 34;
  const baseY = chartY + chartH;

  const legendText = '% Oil-on-Cuttings';
  const legendW = 8;
  const legendX = x + width / 2 - 31;
  doc.save().rect(legendX, y + 5, legendW, 4).fill(GREEN).restore();
  doc.fillColor(GREY).font('Helvetica').fontSize(4.1)
    .text(legendText, legendX + 11, y + 3.6, { width: 55, align: 'left' });

  doc.save()
    .strokeColor('#c8c8c8')
    .lineWidth(0.25)
    .moveTo(chartX, chartY)
    .lineTo(chartX, baseY)
    .lineTo(chartX + chartW, baseY)
    .stroke()
    .restore();

  for (let t = 0; t <= yMax; t += tickStep) {
    const ty = baseY - chartH * (t / yMax);
    doc.fillColor(GREY).font('Helvetica').fontSize(4.0)
      .text(String(t), x + 1, ty - 2, { width: 11, align: 'right' });
    doc.save()
      .strokeColor('#e0e0e0')
      .lineWidth(0.2)
      .moveTo(chartX, ty)
      .lineTo(chartX + chartW, ty)
      .stroke()
      .restore();
  }

  const barGap = 4;
  const barW = Math.max(7, (chartW - barGap * 6) / 5);

  values.forEach((v, i) => {
    const bx = chartX + barGap + i * (barW + barGap);
    const bh = chartH * (Math.min(v, yMax) / yMax);
    const by = baseY - bh;

    if (bh > 0) {
      doc.save().rect(bx, by, barW, bh).fill(GREEN).restore();
    }

    doc.fillColor(BLACK).font('Helvetica-Bold').fontSize(4.0)
      .text(v.toFixed(2), bx - 2, Math.max(chartY, by - 5), { width: barW + 4, align: 'center' });
    doc.fillColor(GREY).font('Helvetica').fontSize(3.7)
      .text(labels[i], bx - 5, baseY + 2, { width: barW + 10, align: 'center' });
  });
}

function drawRetort(doc, data, x, y, width) {
  const d = data.details;
  const r = data.retort;
  const c = data.bypassed;
  const w = data.dailyWaste;
  const a = data.additional;
  const p = data.personnel;
  const settings = data.reportSettings || getReportSettings();
  const engineerLabel = plain(settings.pdf_engineer_label, 'STEP OIL TOOLS ENGINEERS');
  const activityLabel = plain(settings.pdf_activity_label, 'STEP OIL TOOLS ACTIVITIES');

  const leftPct = 72.2;
  const rightPct = 27.8;
  const leftW = width * leftPct / 100;
  const rightW = width - leftW;
  const rightX = x + leftW;

  {
    const h = 10;
    const widths = pctWidths(width, [25, 9.5, 9.5, 9.2, 9.5, 9.5, 13.9, 13.9]);
    let cx = x;

    cell(doc, cx, y, widths[0], h * 2, 'RETORT WORKSHEET\n& VOLUME DISCHARGE', {
      fill: GREEN, color: WHITE, bold: true, align: 'center', fontSize: 4.8
    });
    cx += widths[0];

    cell(doc, cx, y, widths[1], h * 2, 'Shakers\nOverflow', {
      fill: GREEN, color: WHITE, bold: true, align: 'center', fontSize: 4.8
    });
    cx += widths[1];

    cell(doc, cx, y, widths[2], h * 2, 'Dryer', {
      fill: GREEN, color: WHITE, bold: true, align: 'center', fontSize: 4.9
    });
    cx += widths[2];

    for (const [title, serial, wCell] of [
      ['Centrifuge 1', d.cf1_sn, widths[3]],
      ['Centrifuge 2', d.cf2_sn, widths[4]],
      ['Centrifuge 3', d.cf3_sn, widths[5]]
    ]) {
      cell(doc, cx, y, wCell, h, title, { fill: GREEN, color: WHITE, bold: true, align: 'center', fontSize: 4.75 });
      cell(doc, cx, y + h, wCell, h, serial, { fill: GREEN, color: WHITE, bold: true, align: 'center', fontSize: 4.65 });
      cx += wCell;
    }

    const cuttingsW = widths[6] + widths[7];
    cell(doc, cx, y, cuttingsW, h, 'Cuttings By-Passed (to Overboard)', {
      fill: GREEN, color: WHITE, bold: true, align: 'center', fontSize: 4.75
    });
    cell(doc, cx, y + h, widths[6], h, `Percentage(%) : ${plain(c.percentage, '0')}`, { fontSize: 4.25, align: 'left' });
    const fromDepth = [plain(c.from_depth), plain(c.each_from_depth)].filter(Boolean).join(' ');
    cell(doc, cx + widths[6], y + h, widths[7], h, `from depth : ${fromDepth}`, { fontSize: 4.25, align: 'left' });

    y += h * 2;
  }

  const toDepth = [plain(c.to_depth), plain(c.each_to_depth)].filter(Boolean).join(' ');
  y = row(doc, x, y, width, [
    textCell('Type/Model', 25, { unit: '' }),
    textCell(d.sh1_model, 9.5, { align: 'center' }),
    textCell(d.cdu1_model, 9.5, { align: 'center' }),
    textCell(d.cf1_model, 9.2, { align: 'center' }),
    textCell(d.cf2_model, 9.5, { align: 'center' }),
    textCell(d.cf3_model, 9.5, { align: 'center' }),
    textCell(`Volume (bbls) : ${plain(c.volume, '0')}`, 13.9, { fontSize: 4.25 }),
    textCell(`to depth : ${toDepth}`, 13.9, { fontSize: 4.25 })
  ], { height: 10, fontSize: 4.65 });

  const rowsTop = [
    ['Sample Time', '', sampleTime(r.rt_sh_sampletime), sampleTime(r.rt_cdu_sampletime), sampleTime(r.rt_cf1_sampletime), sampleTime(r.rt_cf2_sampletime), sampleTime(r.rt_cf3_sampletime)],
    ['Sample Depth', '(feet)', r.rt_sh_sampledepth, r.rt_cdu_sampledepth, r.rt_cf1_sampledepth, r.rt_cf2_sampledepth, r.rt_cf3_sampledepth],
    ['% Base Fluids fr whole Mud', '(%)', d.basefluid, d.basefluid, d.basefluid, d.basefluid, d.basefluid]
  ];

  for (let i = 0; i < rowsTop.length; i++) {
    const rr = rowsTop[i];
    y = row(doc, x, y, width, [
      textCell(rr[0], 25, { unit: plain(rr[1]), minFontSize: 3.8 }),
      textCell(rr[2], 9.5, { align: 'center' }),
      textCell(rr[3], 9.5, { align: 'center' }),
      textCell(rr[4], 9.2, { align: 'center' }),
      textCell(rr[5], 9.5, { align: 'center' }),
      textCell(rr[6], 9.5, { align: 'center' }),
      ...(i === 0
        ? [greenCell('Daily Waste & Average MOC', 27.8)]
        : i === 1
          ? [textCell(`Daily Waste Generated (Mud & Cuttings), (bbls) : ${plain(w.dailywaste_generated)}`, 27.8, { fontSize: 4.2 })]
          : [
              textCell(`Average MOC : ${plain(w.avg_moc)}`, 13.9, { fontSize: 4.2 }),
              textCell(`Avg Discharge %OOC : ${plain(w.avg_discharge)}`, 13.9, { fontSize: 4.0 })
            ])
    ], { height: 10, fontSize: 4.6, minFontSize: 3.8 });
  }

  const chartTop = y;
  const chartRows = 11;
  const chartRowH = 9.2;
  const chartH = chartRows * chartRowH;
  drawOocChart(doc, r, rightX, chartTop, rightW, chartH);

  const retortRows = [
    ['SG Base Fluids', '(sp.gr)', d.sgbasefluid, d.sgbasefluid, d.sgbasefluid, d.sgbasefluid, d.sgbasefluid],
    ['SG Drill Solids/Cuttings', '(sp.gr)', d.sgdrillsolid, d.sgdrillsolid, d.sgdrillsolid, d.sgdrillsolid, d.sgdrillsolid],
    ['Empty Retort Cell Wt', '(gm)', r.rt_sh_emptycell, r.rt_cdu_emptycell, r.rt_cf1_emptycell, r.rt_cf2_emptycell, r.rt_cf3_emptycell],
    ['Cell + Wet Sample Wt', '(gm)', r.rt_sh_emptycellwetsamp, r.rt_cdu_emptycellwetsamp, r.rt_cf1_emptycellwetsamp, r.rt_cf2_emptycellwetsamp, r.rt_cf3_emptycellwetsamp],
    ['Cell + Dry Cuttings Wt', '(gm)', r.rt_sh_celldrycut, r.rt_cdu_celldrycut, r.rt_cf1_celldrycut, r.rt_cf2_celldrycut, r.rt_cf3_celldrycut],
    ['Empty Grad. Cyl. Wt', '(gm)', r.rt_sh_emptycylinder, r.rt_cdu_emptycylinder, r.rt_cf1_emptycylinder, r.rt_cf2_emptycylinder, r.rt_cf3_emptycylinder],
    ['Water Vol in Cylinder', '(cc)', r.rt_sh_watervolin, r.rt_cdu_watervolin, r.rt_cf1_watervolin, r.rt_cf2_watervolin, r.rt_cf3_watervolin],
    ['Base Fluids Vol in Cylinder', '(cc)', r.rt_sh_basefluidvolincyl, r.rt_cdu_basefluidvolincyl, r.rt_cf1_basefluidvolincyl, r.rt_cf2_basefluidvolincyl, r.rt_cf3_basefluidvolincyl],
    ['Wt Cyl+Water+BaseFluids', '(gm)', r.rt_sh_wtcylwaterbf, r.rt_cdu_wtcylwaterbf, r.rt_cf1_wtcylwaterbf, r.rt_cf2_wtcylwaterbf, r.rt_cf3_wtcylwaterbf],
    ['Mass of Wet Cuttings', '(gm)', r.rt_sh_massofcutting, r.rt_cdu_massofcutting, r.rt_cf1_massofcutting, r.rt_cf2_massofcutting, r.rt_cf3_massofcutting],
    ['Mass of Dry Cuttings', '(gm)', r.rt_sh_massofdry, r.rt_cdu_massofdry, r.rt_cf1_massofdry, r.rt_cf2_massofdry, r.rt_cf3_massofdry]
  ];

  for (const rr of retortRows) {
    y = row(doc, x, y, leftW, [
      textCell(rr[0], 25 / leftPct * 100, { unit: plain(rr[1]), minFontSize: 3.75 }),
      textCell(rr[2], 9.5 / leftPct * 100, { align: 'center' }),
      textCell(rr[3], 9.5 / leftPct * 100, { align: 'center' }),
      textCell(rr[4], 9.2 / leftPct * 100, { align: 'center' }),
      textCell(rr[5], 9.5 / leftPct * 100, { align: 'center' }),
      textCell(rr[6], 9.5 / leftPct * 100, { align: 'center' })
    ], { height: chartRowH, fontSize: 4.45, minFontSize: 3.75 });
  }

  const rigTop = y;
  const rigRows = 5;
  const rigH = rigRows * chartRowH;
  cell(doc, rightX, rigTop, rightW, chartRowH, 'RIG / OTHER ACTIVITIES', {
    fill: GREEN, color: WHITE, bold: true, align: 'center', fontSize: 4.95
  });
  cell(doc, rightX, rigTop + chartRowH, rightW, rigH - chartRowH, plain(a.rigactivity), {
    align: 'left', fontSize: 4.25, padX: 3, padY: 3
  });

  const postChartRows = [
    ['Wt of Water & Base Fluids', '(gm)', r.rt_sh_wtofwaterbf, r.rt_cdu_wtofwaterbf, r.rt_cf1_wtofwaterbf, r.rt_cf2_wtofwaterbf, r.rt_cf3_wtofwaterbf],
    ['Mass of Base Fluids', '(gm)', r.rt_sh_massofbf, r.rt_cdu_massofbf, r.rt_cf1_massofbf, r.rt_cf2_massofbf, r.rt_cf3_massofbf],
    ['Mud-on-Cuttings', '(vol/vol)', r.rt_sh_mudoncutting, r.rt_cdu_mudoncutting, r.rt_cf1_mudoncutting, r.rt_cf2_mudoncutting, r.rt_cf3_mudoncutting],
    ['Oil-on-Cuttings (w.m)', '(%)', r.rt_sh_ooc, r.rt_cdu_ooc, r.rt_cf1_ooc, r.rt_cf2_ooc, r.rt_cf3_ooc],
    ['% of Cuttings Discharged', '(%)', r.rt_sh_percofcutting, r.rt_cdu_percofcutting, r.rt_cf1_percofcutting, r.rt_cf2_percofcutting, r.rt_cf3_percofcutting]
  ];

  for (const rr of postChartRows) {
    y = row(doc, x, y, leftW, [
      textCell(rr[0], 25 / leftPct * 100, { unit: plain(rr[1]), bold: ['Mud-on-Cuttings', 'Oil-on-Cuttings (w.m)'].includes(rr[0]), minFontSize: 3.75 }),
      textCell(rr[2], 9.5 / leftPct * 100, { align: 'center' }),
      textCell(rr[3], 9.5 / leftPct * 100, { align: 'center' }),
      textCell(rr[4], 9.2 / leftPct * 100, { align: 'center' }),
      textCell(rr[5], 9.5 / leftPct * 100, { align: 'center' }),
      textCell(rr[6], 9.5 / leftPct * 100, { align: 'center' })
    ], { height: chartRowH, fontSize: 4.45, minFontSize: 3.75 });
  }

  const dwmTop = y;

  const finalRetortRows = [
    ['Vol Oil Discharge', plain(d.volholeunit), r.rt_sh_volbfoildisc, r.rt_cdu_volbfoildisc, r.rt_cf1_volbfoildisc, r.rt_cf2_volbfoildisc, r.rt_cf3_volbfoildisc],
    ['Vol Mud Discharge', plain(d.volholeunit), r.rt_sh_volmuddisc, r.rt_cdu_volmuddisc, r.rt_cf1_volmuddisc, r.rt_cf2_volmuddisc, r.rt_cf3_volmuddisc]
  ];

  for (const rr of finalRetortRows) {
    y = row(doc, x, y, leftW, [
      textCell(rr[0], 25 / leftPct * 100, { unit: plain(rr[1]), minFontSize: 3.75 }),
      textCell(rr[2], 9.5 / leftPct * 100, { align: 'center' }),
      textCell(rr[3], 9.5 / leftPct * 100, { align: 'center' }),
      textCell(rr[4], 9.2 / leftPct * 100, { align: 'center' }),
      textCell(rr[5], 9.5 / leftPct * 100, { align: 'center' }),
      textCell(rr[6], 9.5 / leftPct * 100, { align: 'center' })
    ], { height: chartRowH, fontSize: 4.45, minFontSize: 3.75 });
  }

  const bottomLeftOil = 27;
  const bottomLeftMud = 21;
  const bottomLeftCum = 52;

  y = row(doc, x, y, leftW, [
    textCell('Oil Recovered', bottomLeftOil, { align: 'center', bold: true }),
    textCell('Mud Recovered', bottomLeftMud, { align: 'center', bold: true }),
    textCell('Cumulative Oil / Mud Recovered', bottomLeftCum, { align: 'center', bold: true })
  ], { height: 9.8, fontSize: 5.0, minFontSize: 4.45 });

  const unit = plain(d.volholeunit);
  const oilText = `${withUnit(r.oil_recovered, unit, '0')}${unit ? ' (oil)' : ''}`;
  const mudText = `${withUnit(r.mud_recovered, unit, '0')}${unit ? ' (mud)' : ''}`;
  const cumOilText = `${withUnit(r.cum_oil, unit, '-')}${unit ? ' (oil)' : ''}`;
  const cumMudText = `${withUnit(r.cum_mud, unit, '-')}${unit ? ' (mud)' : ''}`;

  y = row(doc, x, y, leftW, [
    textCell(oilText, bottomLeftOil, { align: 'center' }),
    textCell(mudText, bottomLeftMud, { align: 'center' }),
    textCell(`${cumOilText}     ${cumMudText}`, bottomLeftCum, { align: 'center' })
  ], { height: 9.4, fontSize: 4.8, minFontSize: 4.3 });

  y = row(doc, x, y, leftW, [
    greenCell('Day', 27, { align: 'left', padX: 4 }),
    greenCell(engineerLabel, 47),
    greenCell('Night', 26, { align: 'right', padX: 4 })
  ], { height: 9.6, fontSize: 4.95, minFontSize: 4.25 });

  y = row(doc, x, y, leftW, [
    textCell(plain(p.ds1_name), 50, { align: 'center' }),
    textCell(plain(p.ns1_name), 50, { align: 'center' })
  ], { height: 9.4, fontSize: 4.85, minFontSize: 4.25 });

  y = row(doc, x, y, leftW, [
    textCell(plain(p.ds2_name), 50, { align: 'center' }),
    textCell(plain(p.ns2_name), 50, { align: 'center' })
  ], { height: 9.4, fontSize: 4.85, minFontSize: 4.25 });

  const leftBottom = y;
  cell(doc, rightX, dwmTop, rightW, chartRowH, activityLabel, {
    fill: GREEN, color: WHITE, bold: true, align: 'center', fontSize: 4.95
  });
  cell(doc, rightX, dwmTop + chartRowH, rightW, Math.max(chartRowH, leftBottom - dwmTop - chartRowH), plain(a.bssactivity), {
    align: 'left', fontSize: 4.25, padX: 3, padY: 3
  });

  return Math.max(leftBottom, dwmTop + chartRowH * 2);
}

function footer(doc) {
  const generated = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: process.env.APP_TIMEZONE || 'Asia/Jakarta'
  }).format(new Date());

  const y = doc.page.height - 19;
  doc.save();
  doc.fillColor(GREY).font('Helvetica').fontSize(4.1)
    .text(
      `Generated by DWM on ${generated}`,
      doc.page.margins.left,
      y,
      {
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
        height: 5,
        align: 'right',
        lineBreak: false
      }
    );
  doc.restore();
}

export function pipeDailyReportPdf(res, data) {
  const reportSettings = getReportSettings();
  GREEN = /^#[0-9a-fA-F]{6}$/.test(reportSettings.pdf_accent_color || '')
    ? reportSettings.pdf_accent_color.toUpperCase()
    : '#267544';
  const renderData = { ...data, reportSettings };

  const doc = new PDFDocument({
    size: PAGE.size,
    layout: PAGE.layout,
    margins: {
      top: PAGE.margin,
      right: PAGE.margin,
      bottom: PAGE.margin,
      left: PAGE.margin
    },
    compress: true,
    bufferPages: true,
    info: {
      Title: `DWM Daily Report ${formatReportNumber(renderData.report.urut, renderData.report.id_wellinfo)}`,
      Author: 'DWM'
    }
  });

  doc.pipe(res);

  const x = 13;
  const width = doc.page.width - 26;

  // Same visual shell as legacy Blade: thin body border inside 10 px page margin.
  doc.save()
    .lineWidth(0.5)
    .strokeColor(BORDER)
    .rect(10, 10, doc.page.width - 20, doc.page.height - 20)
    .stroke()
    .restore();

  let y = 15;
  y = drawHeader(doc, renderData, x, y, width);
  y = drawWellInfo(doc, renderData, x, y, width);
  y = drawActiveMud(doc, renderData, x, y, width);
  y = drawEquipment(doc, renderData, x, y, width);
  y = drawRetort(doc, renderData, x, y, width);

  footer(doc);

  doc.end();
}
