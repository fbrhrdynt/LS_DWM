import ExcelJS from 'exceljs';

const WIDTHS = [
  15, 10, 10, 10, 10, 15, 12, 15, 12, 12, 15,
  12, 15, 12, 8, 8, 12, 10, 10, 12, 12, 10, 15, 12,

  ...Array(42).fill(12),

  15, 12, 12, 12, 12, 12, 12,

  12, 12, 12,
  12, 12,
  20, 20, 20, 20,
  30, 25,
  15, 20, 15, 15, 12, 15
];

function value(v) {
  return v === null || v === undefined ? '' : v;
}

function firstSerials(rows) {
  const first = rows[0] || {};
  return {
    cf1: value(first.cf1_sn),
    cf2: value(first.cf2_sn),
    cf3: value(first.cf3_sn),
    cduModel: value(first.cdu1_model),
    cduSn: value(first.cdu1_sn)
  };
}

export function wellSummaryHeadings(rows = []) {
  const ids = firstSerials(rows);

  return [
    'Date', 'Bit Size', 'Hole Open', 'Washout %', 'Mud Weight', 'Depth 1 Day Before',
    'Depth', 'Vol Hole Drilled', 'Avg ROP', 'Formation', 'Circulating Rate GPM',
    'HGS % Active', 'Active System Vol', 'LGS % Active', 'PV', 'YP', 'Sand Content',
    'Chlorides', 'Mud Temp', 'Oil/Water Ratio', 'E-Stability', 'Fluid Type',
    'Rig Activity', 'SG Base Fluid',

    `Cfuge - ${ids.cf1}\nOOC`, `Cfuge - ${ids.cf1}\nBowl RPM`,
    `Cfuge - ${ids.cf1}\nConveyor RPM`, `Cfuge - ${ids.cf1}\nFeed Pump`,
    `Cfuge - ${ids.cf1}\nVol Cake`, `Cfuge - ${ids.cf1}\nOil Disc`,
    `Cfuge - ${ids.cf1}\nMud Disc`, `Cfuge - ${ids.cf1}\nCake Dens`,
    `Cfuge - ${ids.cf1}\nCake Flow`, `Cfuge - ${ids.cf1}\nCentrate Return`,
    `Cfuge - ${ids.cf1}\nCentrate MW`, `Cfuge - ${ids.cf1}\nFeed MW`,
    `Cfuge - ${ids.cf1}\nPress`, `Cfuge - ${ids.cf1}\nRun Hour`,

    `Cfuge - ${ids.cf2}\nOOC`, `Cfuge - ${ids.cf2}\nBowl RPM`,
    `Cfuge - ${ids.cf2}\nConveyor RPM`, `Cfuge - ${ids.cf2}\nFeed Pump`,
    `Cfuge - ${ids.cf2}\nVol Cake`, `Cfuge - ${ids.cf2}\nOil Disc`,
    `Cfuge - ${ids.cf2}\nMud Disc`, `Cfuge - ${ids.cf2}\nCake Dens`,
    `Cfuge - ${ids.cf2}\nCake Flow`, `Cfuge - ${ids.cf2}\nCentrate Return`,
    `Cfuge - ${ids.cf2}\nCentrate MW`, `Cfuge - ${ids.cf2}\nFeed MW`,
    `Cfuge - ${ids.cf2}\nPress`, `Cfuge - ${ids.cf2}\nRun Hour`,

    `Cfuge - ${ids.cf3}\nOOC`, `Cfuge - ${ids.cf3}\nBowl RPM`,
    `Cfuge - ${ids.cf3}\nConveyor RPM`, `Cfuge - ${ids.cf3}\nFeed Pump`,
    `Cfuge - ${ids.cf3}\nVol Cake`, `Cfuge - ${ids.cf3}\nOil Disc`,
    `Cfuge - ${ids.cf3}\nMud Disc`, `Cfuge - ${ids.cf3}\nCake Dens`,
    `Cfuge - ${ids.cf3}\nCake Flow`, `Cfuge - ${ids.cf3}\nCentrate Return`,
    `Cfuge - ${ids.cf3}\nCentrate MW`, `Cfuge - ${ids.cf3}\nFeed MW`,
    `Cfuge - ${ids.cf3}\nPress`, `Cfuge - ${ids.cf3}\nRun Hour`,

    `Cut Dryer - ${ids.cduModel} ${ids.cduSn}\nOOC`,
    `Cut Dryer - ${ids.cduModel} ${ids.cduSn}\nOil Disc`,
    `Cut Dryer - ${ids.cduModel} ${ids.cduSn}\nMud Disc`,
    `Cut Dryer - ${ids.cduModel} ${ids.cduSn}\nTo Dryer`,
    `Cut Dryer - ${ids.cduModel} ${ids.cduSn}\nFrom Dryer`,
    `Cut Dryer - ${ids.cduModel} ${ids.cduSn}\nScreen Size`,
    `Cut Dryer - ${ids.cduModel} ${ids.cduSn}\nRun Hour`,

    'Shaker\nOOC', 'Oil Recovered', 'Mud Recovered',
    'Cumulative Oil', 'Cumulative Mud',
    'ENGINEER\nDay Shift 1', 'ENGINEER\nDay Shift 2',
    'ENGINEER\nNight Shift 1', 'ENGINEER\nNight Shift 2',
    'Rig Activity', 'DWM Activities',
    'Operator', 'Well Name', 'Location', 'Company Man', 'OIM', 'Drilling Rig'
  ];
}

export function mapWellSummaryRow(row) {
  return [
    value(row.curdate), value(row.bitsize), '', value(row.washout), value(row.mudweight),
    value(row.depth1bef), value(row.curdepth), value(row.volholedrill), value(row.avgrop), '',
    value(row.cirrategpm), value(row.hgsactive), value(row.activesysvol), value(row.lgsactive),
    value(row.pv), value(row.yp), value(row.sandcontent), value(row.chlorides), value(row.mudtemp),
    value(row.categories2), value(row.categories1), value(row.fluidtype), value(row.rigactivity),
    value(row.sgbasefluid),

    value(row.rt_cf1_ooc), value(row.cf1_bowlspeed), value(row.cf1_bowlconv), value(row.cf1_feedsuc),
    value(row.cf1_volcake), value(row.rt_cf1_volbfoildisc), value(row.rt_cf1_volmuddisc),
    value(row.cf1_cakediscdens), value(row.cf1_cakediscflow), value(row.cf1_centratereturn),
    value(row.cf1_centratedens), value(row.cf1_feedindensity), '', value(row.cf1_runninghour),

    value(row.rt_cf2_ooc), value(row.cf2_bowlspeed), value(row.cf2_bowlconv), value(row.cf2_feedsuc),
    value(row.cf2_volcake), value(row.rt_cf2_volbfoildisc), value(row.rt_cf2_volmuddisc),
    value(row.cf2_cakediscdens), value(row.cf2_cakediscflow), value(row.cf2_centratereturn),
    value(row.cf2_centratedens), value(row.cf2_feedindensity), '', value(row.cf2_runninghour),

    value(row.rt_cf3_ooc), value(row.cf3_bowlspeed), value(row.cf3_bowlconv), value(row.cf3_feedsuc),
    value(row.cf3_volcake), value(row.rt_cf3_volbfoildisc), value(row.rt_cf3_volmuddisc),
    value(row.cf3_cakediscdens), value(row.cf3_cakediscflow), value(row.cf3_centratereturn),
    value(row.cf3_centratedens), value(row.cf3_feedindensity), '', value(row.cf3_runninghour),

    value(row.rt_cdu_ooc), value(row.rt_cdu_volbfoildisc), value(row.rt_cdu_volmuddisc),
    value(row.vctodryer_bbls), value(row.vcfrdryer_bbls), value(row.cdu1_screensize),
    value(row.cdu1_runninghour),

    value(row.rt_sh_ooc), value(row.oil_recovered), value(row.mud_recovered),
    value(row.cum_oil), value(row.cum_mud),

    value(row.ds1_name), value(row.ds2_name), value(row.ns1_name), value(row.ns2_name),

    value(row.rigactivity), value(row.bssactivity),

    value(row.project_operator_name), value(row.wellname), value(row.location),
    value(row.companyman), value(row.oim), value(row.project_drillingrig)
  ];
}

export async function buildWellSummaryWorkbook({ project, rows }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'DWM';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Well Summary', {
    views: [{ state: 'frozen', ySplit: 1 }]
  });

  const headings = wellSummaryHeadings(rows);
  worksheet.addRow(headings);

  for (const row of rows) {
    worksheet.addRow(mapWellSummaryRow(row));
  }

  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, worksheet.rowCount), column: headings.length }
  };

  const header = worksheet.getRow(1);
  header.height = 42;
  header.font = { bold: true, size: 9 };
  header.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  header.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD9D9D9' }
  };

  for (let i = 1; i <= headings.length; i++) {
    worksheet.getColumn(i).width = WIDTHS[i - 1] || 12;
    worksheet.getColumn(i).alignment = { vertical: 'top', wrapText: true };
  }

  const thin = { style: 'thin', color: { argb: 'FFB8B8B8' } };
  worksheet.eachRow((row) => {
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = { top: thin, left: thin, bottom: thin, right: thin };
      if (row.number > 1) {
        cell.font = { size: 9 };
      }
    });
  });

  worksheet.getCell('A1').note =
    `DWM Well Summary · ${project.operator_name || ''} · ${project.contract || ''}`;

  return workbook;
}

export function wellSummaryColumnCount(rows = []) {
  return wellSummaryHeadings(rows).length;
}
