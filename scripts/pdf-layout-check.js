import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { pipeDailyReportPdf } from '../src/services/pdf-report.service.js';

const output = path.join(os.tmpdir(), `dwm-pdf-check-${process.pid}.pdf`);

const rendererSource = fs.readFileSync(new URL('../src/services/pdf-report.service.js', import.meta.url), 'utf8');
if (/ellipsis:\s*options\.ellipsis\s*!==\s*false/.test(rendererSource)) {
  throw new Error('PDF renderer still enables automatic cell ellipsis.');
}
if (!/ellipsis:\s*false/.test(rendererSource)) {
  throw new Error('PDF renderer must explicitly disable automatic cell ellipsis.');
}
if (!/function labelUnitCell\(/.test(rendererSource)) {
  throw new Error('PDF renderer must keep units inside the parameter cell.');
}
if (/Math\.max\(y,\s*dwmTop/.test(rendererSource)) {
  throw new Error('PDF renderer still inserts the legacy blank gap above Oil Recovered.');
}
if (!/pdf_engineer_label/.test(rendererSource) || !/pdf_activity_label/.test(rendererSource)) {
  throw new Error('PDF dynamic Engineer/Activity labels are missing.');
}
const chunks = [];
const stream = new PassThrough();
stream.on('data', chunk => chunks.push(chunk));
stream.on('finish', () => fs.writeFileSync(output, Buffer.concat(chunks)));

const response = stream;
response.setHeader = () => {};

const details = {
  curdepth: '2500', depth1bef: '2000', bitsize: '17.5', bittype: 'PDC', washout: '10',
  volholedrill: '163.69', volholeunit: 'bbls', avgrop: '60', fluidtype: 'OBM-SB',
  rigpresentact: 'Drilling 17.5', cirrategpm: '800', mudweight: '9.7', mwunit: 'ppg',
  lgsactive: '3.2', pv: '24', yp: '18', categories1: '550', mudtemp: '30', tempunit: 'degf',
  hgsactive: '4.5', sandcontent: '0.3', chlorides: '50000', categories2: '62.5', basefluid: '62.5',
  sgbasefluid: '0.78', sgdrillsolid: '2.6',
  cf1_sn: 'CFSN1', cf2_sn: '2222', cf3_sn: 'CFSN3', cf1_model:'1000FRDRYER',cf2_model:'HNH',cf3_model:'1000GBD',
  cf1_modeofopr:'FRDRYER',cf2_modeofopr:'FRDRYER',cf3_modeofopr:'BARITE',
  cf1_weirplate:'3.5',cf2_weirplate:'3.5',cf3_weirplate:'3.5',cf1_bowlspeed:'2500',cf2_bowlspeed:'2500',cf3_bowlspeed:'2500',
  cf1_bowlconv:'1500',cf2_bowlconv:'1500',cf3_bowlconv:'1200',cf1_feedsuc:'OVERBOARD',cf2_feedsuc:'SANDTRAPTANK',cf3_feedsuc:'OVERBOARD',
  cf1_effluentreturn:'CUTTINGSKIPS',cf2_effluentreturn:'ACTIVETANK',cf3_effluentreturn:'CUTTINGSKIPS', screens_changed:'API 100 changed',
  cf1_underflow:'SANDTRAPTANK',cf2_underflow:'JUMBOBAG',cf3_underflow:'JUMBOBAG',cf1_runninghour:'8',cf2_runninghour:'8',cf3_runninghour:'9',
  cf1_feedinrate:'50',cf2_feedinrate:'50',cf3_feedinrate:'50',cf1_feedindensity:'10.6',cf2_feedindensity:'10.6',cf3_feedindensity:'9.3',
  cf1_centratedens:'9.8',cf2_centratedens:'9.8',cf3_centratedens:'8.1',cf1_cakediscdens:'22.4',cf2_cakediscdens:'22.4',cf3_cakediscdens:'10.3',
  cf1_centratereturn:'46.83',cf2_centratereturn:'46.83',cf3_centratereturn:'22.73',cf1_cakediscflow:'3.17',cf2_cakediscflow:'3.17',cf3_cakediscflow:'27.27',
  cf1_masscake:'10.84',cf2_masscake:'10.84',cf3_masscake:'48.16',cf1_volcake:'36.28',cf2_volcake:'36.28',cf3_volcake:'350.65',
  sh1_name:'Shaker #1',sh1_model:'Model X1',sh1_screensize:'API 1001',sh1_runninghour:'01',
  sh2_name:'Shaker #2',sh2_model:'Model X2',sh2_screensize:'API 1002',sh2_runninghour:'02',
  sh3_name:'Shaker #3',sh3_model:'Model X3',sh3_screensize:'API 1003',sh3_runninghour:'03',
  sh4_name:'Shaker #4',sh4_model:'Model X4',sh4_screensize:'API 1004',sh4_runninghour:'04',
  sh5_name:'Shaker #5',sh5_model:'Model X5',sh5_screensize:'API 1005',sh5_runninghour:'05',
  sh6_name:'Shaker #6',sh6_model:'Model X6',sh6_screensize:'API 1006',sh6_runninghour:'07',
  cdu1_model:'WSM01'
};

const retort = {};
for (const prefix of ['sh','cdu','cf1','cf2','cf3']) {
  Object.assign(retort, {
    [`rt_${prefix}_sampletime`]:'0', [`rt_${prefix}_sampledepth`]:'2200', [`rt_${prefix}_emptycell`]:'855',
    [`rt_${prefix}_emptycellwetsamp`]:'950', [`rt_${prefix}_celldrycut`]:'925', [`rt_${prefix}_emptycylinder`]:'63',
    [`rt_${prefix}_watervolin`]:'8.3', [`rt_${prefix}_basefluidvolincyl`]:'8.6', [`rt_${prefix}_wtcylwaterbf`]:'78',
    [`rt_${prefix}_massofcutting`]:'93', [`rt_${prefix}_massofdry`]:'67', [`rt_${prefix}_wtofwaterbf`]:'15',
    [`rt_${prefix}_massofbf`]:'6.7', [`rt_${prefix}_mudoncutting`]:'0.46', [`rt_${prefix}_ooc`]:'7.20',
    [`rt_${prefix}_percofcutting`]:'100', [`rt_${prefix}_volbfoildisc`]:'7.19', [`rt_${prefix}_volmuddisc`]:'11.50'
  });
}
Object.assign(retort,{oil_recovered:'14.70',mud_recovered:'23.50',cum_oil:'91.30',cum_mud:'146.10'});

pipeDailyReportPdf(response, {
  project:{id_project:1,operator_name:'MEDCO',contract:'TEST',drillingrig:'GRISSIK',logo:''},
  report:{id_wellinfo:2,urut:'2',wellname:'gfgf',curdate:'2025-04-11',spud_date:'2025-04-03',location:'dsds',companyman:'r3ed',oim:'544'},
  details, retort,
  desander:{run_hour:'2',feed_rate:'50',feed_dens:'10',overflow_dens:'9.3',underflow_dens:'10.3',vol_discharge:'9',mudoncuttings:'1',volmud_discharge:'18',head_pressure:'23'},
  desilter:{run_hour:'4',feed_rate:'50',feed_dens:'9.3',overflow_dens:'8.1',underflow_dens:'10.3',vol_discharge:'10',mudoncuttings:'3.2',volmud_discharge:'134.4',head_pressure:'120'},
  bypassed:{percentage:'69',from_depth:'44',volume:'43',to_depth:'55'},
  dailyWaste:{dailywaste_generated:'35',avg_moc:'2.12',avg_discharge:'7.0'},
  personnel:{ds1_name:'Febro',ds2_name:'Anggara',ns1_name:'Dimas',ns2_name:'Anggara'},
  additional:{rigactivity:'Drilling and circulating. No abnormal operation observed.',bssactivity:'Routine DWM monitoring and solids control optimization.'}
});

await new Promise((resolve, reject) => {
  stream.on('finish', resolve);
  stream.on('error', reject);
});

const buffer = fs.readFileSync(output);
const text = buffer.toString('latin1');
const pages = (text.match(/\/Type\s*\/Page\b/g) || []).length;
if (pages !== 1) throw new Error(`Expected exactly 1 PDF page, got ${pages}`);
if (buffer.length < 10000) throw new Error(`PDF output unexpectedly small: ${buffer.length} bytes`);
console.log(`PDF layout check: OK (1 page, ${buffer.length} bytes)`);
fs.rmSync(output, { force: true });
