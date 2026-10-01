import PDFDocument from 'pdfkit';

const GREEN = '#267544';
const DARK = '#17202a';
const MUTED = '#5f6b78';
const LINE = '#b7bec7';
const LIGHT = '#f1f4f7';
const WHITE = '#ffffff';

function show(value, fallback = '-') {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
}

function number(value, digits = 2) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '-';
  return parsed.toFixed(digits);
}

function fluidName(code) {
  return ({
    'WB-SW': 'Sea Water',
    'WB-WB': 'Water Base',
    'WB-WBH': 'Water Base HPWBM',
    'OBM-LT': 'LT-Oil Base',
    'OBM-SB': 'Synthetic Base',
    'OBM-EN': 'Enviromul'
  })[code] || show(code);
}

function ensureSpace(doc, height = 40) {
  const limit = doc.page.height - doc.page.margins.bottom - 18;
  if (doc.y + height > limit) doc.addPage();
}

function sectionTitle(doc, title) {
  ensureSpace(doc, 24);
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const y = doc.y;
  doc.save().rect(x, y, width, 16).fill(GREEN).restore();
  doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(7.5)
    .text(title, x, y + 4, { width, align: 'center', characterSpacing: 1.2 });
  doc.fillColor(DARK);
  doc.y = y + 18;
}

function keyValueGrid(doc, items, columns = 3) {
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const colWidth = width / columns;
  const rowHeight = 22;

  for (let i = 0; i < items.length; i += columns) {
    ensureSpace(doc, rowHeight + 2);
    const y = doc.y;

    for (let c = 0; c < columns; c++) {
      const item = items[i + c];
      if (!item) continue;
      const cx = x + c * colWidth;

      doc.save().rect(cx, y, colWidth, rowHeight).strokeColor(LINE).lineWidth(0.35).stroke().restore();
      doc.fillColor(MUTED).font('Helvetica').fontSize(5.5)
        .text(item[0], cx + 4, y + 3, { width: colWidth - 8, height: 7 });
      doc.fillColor(DARK).font('Helvetica-Bold').fontSize(7)
        .text(show(item[1]), cx + 4, y + 11, { width: colWidth - 8, height: 8, ellipsis: true });
    }

    doc.y = y + rowHeight;
  }

  doc.moveDown(0.35);
}

function table(doc, headers, rows, widths, options = {}) {
  const x = doc.page.margins.left;
  const rowHeight = options.rowHeight || 17;
  const headerHeight = options.headerHeight || 20;

  const drawHeader = () => {
    ensureSpace(doc, headerHeight + rowHeight);
    const y = doc.y;
    let cx = x;
    headers.forEach((header, i) => {
      const width = widths[i];
      doc.save().rect(cx, y, width, headerHeight).fill(LIGHT).strokeColor(LINE).lineWidth(0.35).stroke().restore();
      doc.fillColor(DARK).font('Helvetica-Bold').fontSize(options.headerFont || 5.7)
        .text(header, cx + 2, y + 4, { width: width - 4, height: headerHeight - 5, align: 'center', ellipsis: true });
      cx += width;
    });
    doc.y = y + headerHeight;
  };

  drawHeader();

  rows.forEach((row) => {
    if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom - 18) {
      doc.addPage();
      drawHeader();
    }

    const y = doc.y;
    let cx = x;

    row.forEach((cell, i) => {
      const width = widths[i];
      doc.save().rect(cx, y, width, rowHeight).strokeColor(LINE).lineWidth(0.3).stroke().restore();
      doc.fillColor(DARK).font(i === 0 && options.boldFirst ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(options.font || 5.5)
        .text(show(cell), cx + 2, y + 4, {
          width: width - 4,
          height: rowHeight - 5,
          align: i === 0 && options.leftFirst ? 'left' : 'center',
          ellipsis: true
        });
      cx += width;
    });

    doc.y = y + rowHeight;
  });

  doc.moveDown(0.45);
}

function drawOocChart(doc, retort) {
  ensureSpace(doc, 104);
  const x = doc.page.margins.left;
  const width = 280;
  const height = 82;
  const y = doc.y + 4;

  const labels = ['Shaker', 'Dryer', 'CF1', 'CF2', 'CF3'];
  const values = [
    Number(retort.rt_sh_ooc) || 0,
    Number(retort.rt_cdu_ooc) || 0,
    Number(retort.rt_cf1_ooc) || 0,
    Number(retort.rt_cf2_ooc) || 0,
    Number(retort.rt_cf3_ooc) || 0
  ];

  doc.font('Helvetica-Bold').fontSize(7).fillColor(DARK).text('Oil-on-Cuttings (%)', x, doc.y);
  const chartY = y + 10;
  const baseline = chartY + height - 14;

  doc.save().strokeColor(LINE).lineWidth(0.5)
    .moveTo(x + 24, chartY).lineTo(x + 24, baseline)
    .lineTo(x + width, baseline).stroke().restore();

  const barWidth = 30;
  const gap = 18;

  values.forEach((raw, i) => {
    const v = Math.max(0, Math.min(100, raw));
    const barHeight = (height - 24) * (v / 100);
    const bx = x + 40 + i * (barWidth + gap);
    const by = baseline - barHeight;

    doc.save().rect(bx, by, barWidth, barHeight).fill(GREEN).restore();
    doc.fillColor(DARK).font('Helvetica').fontSize(5.3)
      .text(number(v, 1), bx, by - 8, { width: barWidth, align: 'center' });
    doc.fillColor(MUTED).fontSize(5.1)
      .text(labels[i], bx - 5, baseline + 3, { width: barWidth + 10, align: 'center' });
  });

  doc.y = chartY + height + 6;
}

function addFooters(doc) {
  const range = doc.bufferedPageRange();
  const generated = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: process.env.APP_TIMEZONE || 'Asia/Jakarta'
  }).format(new Date());

  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const y = doc.page.height - 15;
    doc.fillColor(MUTED).font('Helvetica').fontSize(5.2)
      .text(`Generated by DWM · ${generated}`, doc.page.margins.left, y, { align: 'left' })
      .text(`Page ${i - range.start + 1} / ${range.count}`, 0, y, {
        width: doc.page.width - doc.page.margins.right,
        align: 'right'
      });
  }
}

export function pipeDailyReportPdf(res, data) {
  const { project, report, details, retort, desander, desilter, bypassed, dailyWaste, personnel, additional } = data;

  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margin: 18,
    bufferPages: true,
    info: {
      Title: `DWM Daily Report ${show(report.urut, report.id_wellinfo)}`,
      Author: 'DWM'
    }
  });

  doc.pipe(res);

  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  doc.fillColor(DARK).font('Helvetica-Bold').fontSize(16)
    .text(`DWM DAILY REPORT NO. ${show(report.urut, report.id_wellinfo)}`, { align: 'center' });
  doc.font('Helvetica').fontSize(6.5).fillColor(MUTED)
    .text(`${show(project.operator_name)} · ${show(project.contract)} · ${show(project.drillingrig)}`, { align: 'center' });
  doc.moveDown(0.6);

  sectionTitle(doc, 'WELL INFORMATION');
  keyValueGrid(doc, [
    ['Operator', project.operator_name],
    ['Well Name', report.wellname],
    ['Date', report.curdate],
    ['Location', report.location],
    ['Current Depth', `${show(details.curdepth)} ${show(details.depth_each, '')}`.trim()],
    ['Depth 1 Day Before', `${show(details.depth1bef)} ${show(details.depth_each, '')}`.trim()],
    ['Operator Rep', report.companyman],
    ['Contractor Rep / OIM', report.oim],
    ['Spud-in Date', report.spud_date],
    ['Drilling Rig', project.drillingrig],
    ['Bit Size', `${show(details.bitsize)} inch`],
    ['Bit Type', details.bittype],
    ['Washout', `${show(details.washout)} %`],
    ['Vol. Hole Drilled', `${show(details.volholedrill)} ${show(details.volholeunit, '')}`.trim()],
    ['Average ROP', details.avgrop]
  ], 3);

  sectionTitle(doc, 'ACTIVE MUD PROPERTIES');
  keyValueGrid(doc, [
    ['Fluid Type', fluidName(details.fluidtype)],
    ['Mud Weight', `${show(details.mudweight)} ${show(details.mwunit, '')}`.trim()],
    ['PV', details.pv],
    ['YP', details.yp],
    ['LGS % Active', details.lgsactive],
    ['HGS % Active', details.hgsactive],
    ['Sand Content', details.sandcontent],
    ['Chlorides', details.chlorides],
    ['Mud Temperature', `${show(details.mudtemp)} ${details.tempunit === 'degc' ? '°C' : details.tempunit === 'degf' ? '°F' : ''}`.trim()],
    ['Base Fluid', `${show(details.basefluid)} %`],
    ['SG Base Fluid', details.sgbasefluid],
    ['SG Drill Solids', details.sgdrillsolid],
    ['Circulating Rate', `${show(details.cirrategpm)} gpm`],
    ['Active System Vol.', details.activesysvol],
    ['Rig Present Activity', details.rigpresentact]
  ], 3);

  sectionTitle(doc, 'CENTRIFUGES & SHALE SHAKERS');
  const equipWidth = pageWidth;
  const eqWidths = [135, 35, 82, 82, 82, 70, 120, 105, 52];
  const centrifugeRows = [
    ['Serial Number', '', details.cf1_sn, details.cf2_sn, details.cf3_sn, details.sh1_name, details.sh1_model, details.sh1_screensize, details.sh1_runninghour],
    ['Mode of Operation', '', details.cf1_modeofopr, details.cf2_modeofopr, details.cf3_modeofopr, details.sh2_name, details.sh2_model, details.sh2_screensize, details.sh2_runninghour],
    ['Bowl-Conveyor Wear', 'mm', details.cf1_weirplate, details.cf2_weirplate, details.cf3_weirplate, details.sh3_name, details.sh3_model, details.sh3_screensize, details.sh3_runninghour],
    ['Bowl Speed', 'rpm', details.cf1_bowlspeed, details.cf2_bowlspeed, details.cf3_bowlspeed, details.sh4_name, details.sh4_model, details.sh4_screensize, details.sh4_runninghour],
    ['Differential Speed', 'rpm', details.cf1_bowlconv, details.cf2_bowlconv, details.cf3_bowlconv, details.sh5_name, details.sh5_model, details.sh5_screensize, details.sh5_runninghour],
    ['Feed-in Suction', '', details.cf1_feedsuc, details.cf2_feedsuc, details.cf3_feedsuc, details.sh6_name, details.sh6_model, details.sh6_screensize, details.sh6_runninghour],
    ['Effluent Return', '', details.cf1_effluentreturn, details.cf2_effluentreturn, details.cf3_effluentreturn, 'Screens Changed', details.screens_changed, '', ''],
    ['Underflow Discharge', '', details.cf1_underflow, details.cf2_underflow, details.cf3_underflow, '', '', '', ''],
    ['Running Hours', 'hr', details.cf1_runninghour, details.cf2_runninghour, details.cf3_runninghour, '', '', '', ''],
    ['Feed-in Rate', '', details.cf1_feedinrate, details.cf2_feedinrate, details.cf3_feedinrate, '', '', '', ''],
    ['Feed-in Density', '', details.cf1_feedindensity, details.cf2_feedindensity, details.cf3_feedindensity, '', '', '', ''],
    ['Centrate Density', '', details.cf1_centratedens, details.cf2_centratedens, details.cf3_centratedens, '', '', '', ''],
    ['Cake Discharge Density', '', details.cf1_cakediscdens, details.cf2_cakediscdens, details.cf3_cakediscdens, '', '', '', ''],
    ['Cake Discharge Flow', '', details.cf1_cakediscflow, details.cf2_cakediscflow, details.cf3_cakediscflow, '', '', '', '']
  ];
  table(
    doc,
    ['Parameter', 'Unit', 'Centrifuge 1', 'Centrifuge 2', 'Centrifuge 3', 'Shaker', 'Model', 'Screen Size', 'Run Hr'],
    centrifugeRows,
    eqWidths,
    { rowHeight: 15, headerHeight: 19, font: 5.2, headerFont: 5.4, boldFirst: true, leftFirst: true }
  );

  sectionTitle(doc, 'CUTTING DRYERS / DESANDER / DESILTER');
  table(doc,
    ['Parameter', 'Cutting Dryer 1', 'Cutting Dryer 2', 'Desander', 'Desilter'],
    [
      ['Serial / Run Hour', details.cdu1_sn, details.cdu2_sn, desander.run_hour, desilter.run_hour],
      ['Model / Feed Rate', details.cdu1_model, details.cdu2_model, desander.feed_rate, desilter.feed_rate],
      ['Screen / Feed Density', details.cdu1_screensize, details.cdu2_screensize, desander.feed_dens, desilter.feed_dens],
      ['Running Hour / Overflow Density', details.cdu1_runninghour, details.cdu2_runninghour, desander.overflow_dens, desilter.overflow_dens],
      ['Centrate / Underflow Density', details.cdu1_centrateppg, details.cdu2_centrateppg, desander.underflow_dens, desilter.underflow_dens],
      ['Sample Depth / Discharge Volume', details.cdu1_sampledepth, details.cdu2_sampledepth, desander.vol_discharge, desilter.vol_discharge],
      ['Mud on Cuttings', '-', '-', desander.mudoncuttings, desilter.mudoncuttings],
      ['Mud Discharge', '-', '-', desander.volmud_discharge, desilter.volmud_discharge],
      ['Head Pressure', '-', '-', desander.head_pressure, desilter.head_pressure]
    ],
    [180, 150, 150, 160, 160],
    { rowHeight: 16, headerHeight: 19, font: 5.5, boldFirst: true, leftFirst: true }
  );

  sectionTitle(doc, 'RETORT WORKSHEET');
  const prefixes = [
    ['sh', 'Shaker'],
    ['cdu', 'Cutting Dryer'],
    ['cf1', 'Centrifuge 1'],
    ['cf2', 'Centrifuge 2'],
    ['cf3', 'Centrifuge 3']
  ];
  const retortRows = [
    ['Sample Time', ...prefixes.map(([p]) => {
      const v = retort[`rt_${p}_sampletime`];
      if (v === null || v === undefined || v === '') return '-';
      const mins = Number(v);
      if (!Number.isFinite(mins)) return show(v);
      return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
    })],
    ['Sample Depth', ...prefixes.map(([p]) => retort[`rt_${p}_sampledepth`])],
    ['Empty Cell (gm)', ...prefixes.map(([p]) => retort[`rt_${p}_emptycell`])],
    ['Cell + Wet Sample (gm)', ...prefixes.map(([p]) => retort[`rt_${p}_emptycellwetsamp`])],
    ['Cell + Dry Cuttings (gm)', ...prefixes.map(([p]) => retort[`rt_${p}_celldrycut`])],
    ['Empty Cylinder (gm)', ...prefixes.map(([p]) => retort[`rt_${p}_emptycylinder`])],
    ['Water Vol. Cylinder (ml)', ...prefixes.map(([p]) => retort[`rt_${p}_watervolin`])],
    ['Base Fluid Vol. Cylinder', ...prefixes.map(([p]) => retort[`rt_${p}_basefluidvolincyl`])],
    ['Wt Cyl + Water/BF', ...prefixes.map(([p]) => retort[`rt_${p}_wtcylwaterbf`])],
    ['Mass Wet Cuttings', ...prefixes.map(([p]) => retort[`rt_${p}_massofcutting`])],
    ['Mass Dry Cuttings', ...prefixes.map(([p]) => retort[`rt_${p}_massofdry`])],
    ['Wt Water & Base Fluid', ...prefixes.map(([p]) => retort[`rt_${p}_wtofwaterbf`])],
    ['Mass Base Fluid', ...prefixes.map(([p]) => retort[`rt_${p}_massofbf`])],
    ['Mud-on-Cuttings', ...prefixes.map(([p]) => retort[`rt_${p}_mudoncutting`])],
    ['Oil-on-Cuttings %', ...prefixes.map(([p]) => retort[`rt_${p}_ooc`])],
    ['% Cuttings Discharged', ...prefixes.map(([p]) => retort[`rt_${p}_percofcutting`])],
    ['Vol Oil Discharge', ...prefixes.map(([p]) => retort[`rt_${p}_volbfoildisc`])],
    ['Vol Mud Discharge', ...prefixes.map(([p]) => retort[`rt_${p}_volmuddisc`])]
  ];
  table(
    doc,
    ['Parameter', ...prefixes.map(([, label]) => label)],
    retortRows,
    [220, 112, 112, 112, 112, 112],
    { rowHeight: 14, headerHeight: 18, font: 5.1, headerFont: 5.3, boldFirst: true, leftFirst: true }
  );

  sectionTitle(doc, 'RECOVERY / DAILY WASTE');
  keyValueGrid(doc, [
    ['Oil Recovered', `${show(retort.oil_recovered)} ${show(details.volholeunit, '')}`.trim()],
    ['Mud Recovered', `${show(retort.mud_recovered)} ${show(details.volholeunit, '')}`.trim()],
    ['Cumulative Oil', `${show(retort.cum_oil)} ${show(details.volholeunit, '')}`.trim()],
    ['Cumulative Mud', `${show(retort.cum_mud)} ${show(details.volholeunit, '')}`.trim()],
    ['Daily Waste Generated', dailyWaste.dailywaste_generated],
    ['Average MOC', dailyWaste.avg_moc],
    ['Average Discharge %OOC', dailyWaste.avg_discharge],
    ['Cuttings By-Passed', `${show(bypassed.percentage)} % / ${show(bypassed.volume)} bbls`]
  ], 4);

  drawOocChart(doc, retort);

  sectionTitle(doc, 'DWM PERSONNEL & ACTIVITIES');
  keyValueGrid(doc, [
    ['Day Shift 1', personnel.ds1_name],
    ['Day Shift 2', personnel.ds2_name],
    ['Night Shift 1', personnel.ns1_name],
    ['Night Shift 2', personnel.ns2_name]
  ], 4);

  ensureSpace(doc, 72);
  const x = doc.page.margins.left;
  const w = (doc.page.width - doc.page.margins.left - doc.page.margins.right - 8) / 2;
  const y = doc.y;
  for (const [title, text, offset] of [
    ['RIG / OTHER ACTIVITIES', additional.rigactivity, 0],
    ['DWM ACTIVITIES', additional.bssactivity, w + 8]
  ]) {
    doc.save().rect(x + offset, y, w, 62).strokeColor(LINE).lineWidth(0.4).stroke().restore();
    doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(6.2)
      .text(title, x + offset + 5, y + 5, { width: w - 10 });
    doc.fillColor(DARK).font('Helvetica').fontSize(6)
      .text(show(text, 'No activity recorded.'), x + offset + 5, y + 17, {
        width: w - 10,
        height: 39,
        ellipsis: true
      });
  }
  doc.y = y + 66;

  addFooters(doc);
  doc.end();
}
