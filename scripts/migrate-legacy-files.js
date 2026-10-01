import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { all, get, run, db } from '../src/config/db.js';
import { uploadRoot, fileExists } from '../src/services/file-storage.js';

const args = process.argv.slice(2);
const rootArg = args.find(arg => !arg.startsWith('--'));
const apply = args.includes('--apply');
if (!rootArg) {
  console.error('Usage: npm run legacy:files -- /path/to/old-laravel [--apply]');
  process.exit(2);
}
const legacyRoot = path.resolve(rootArg);
if (!fs.existsSync(legacyRoot)) { console.error(`Legacy root not found: ${legacyRoot}`); process.exit(2); }

function cleanName(value) { return String(value||'file').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/-+/g,'-').slice(0,90); }
function locate(stored, extra=[]) {
  if (!stored) return null;
  const normalized=String(stored).replaceAll('\\','/').replace(/^public\//,'').replace(/^\/+/, '');
  const candidates=[
    path.join(legacyRoot,'storage','app','public',normalized),
    path.join(legacyRoot,'public','storage',normalized),
    ...extra.map(x=>path.join(legacyRoot,x))
  ];
  return candidates.find(p=>fs.existsSync(p) && fs.statSync(p).isFile()) || null;
}
function target(folder, source) {
  fs.mkdirSync(path.join(uploadRoot,folder),{recursive:true});
  const ext=path.extname(source).toLowerCase();
  const stem=cleanName(path.basename(source,ext));
  return path.join(uploadRoot,folder,`${Date.now()}-${crypto.randomUUID()}-${stem}${ext}`);
}
const plan=[];
function planRow(kind,id,stored,folder,table,column,idColumn,extra=[]) {
  if (!stored || fileExists(stored)) return;
  const source=locate(stored,extra); if (!source) { plan.push({kind,id,status:'source-missing',stored}); return; }
  const dest=target(folder,source); const relative=path.relative(uploadRoot,dest).split(path.sep).join('/');
  plan.push({kind,id,status:'ready',source,dest,relative,table,column,idColumn});
}

for (const r of all(`SELECT id,coc FROM assets_list WHERE coc IS NOT NULL AND trim(coc)<>''`)) planRow('COC',r.id,r.coc,'coc','assets_list','coc','id');
for (const r of all(`SELECT id,cert FROM inspection_detail WHERE cert IS NOT NULL AND trim(cert)<>''`)) planRow('Inspection',r.id,r.cert,'inspection','inspection_detail','cert','id');
for (const r of all(`SELECT id,file_path FROM pm_data WHERE file_path IS NOT NULL AND trim(file_path)<>''`)) planRow('PM document',r.id,r.file_path,'pm-documents','pm_data','file_path','id');
for (const r of all(`SELECT id_project,logo FROM projects WHERE logo IS NOT NULL AND trim(logo)<>''`)) planRow('Client logo',r.id_project,r.logo,'project-logos','projects','logo','id_project',[path.join('public','isi','logos',path.basename(String(r.logo)))]);

const company = get(`SELECT value FROM app_settings WHERE key='company_logo' LIMIT 1`);
if (!company?.value || !fileExists(company.value)) {
  const source=locate(company?.value || 'stepoil_logo.jpeg',[path.join('public','stepoil_logo.jpeg')]);
  if (source) {
    const dest=target('branding',source); const relative=path.relative(uploadRoot,dest).split(path.sep).join('/');
    plan.push({kind:'Company logo',id:'setting',status:'ready',source,dest,relative,setting:true});
  }
}

console.log(`${apply ? 'APPLY' : 'DRY RUN'} - ${plan.length} legacy file action(s)`);
for (const item of plan) console.log(`${item.status.toUpperCase()} ${item.kind} #${item.id}: ${item.source || item.stored || ''}`);

if (apply) {
  for (const item of plan.filter(x=>x.status==='ready')) {
    fs.copyFileSync(item.source,item.dest);
    if (item.setting) {
      run(`INSERT INTO app_settings (key,value,updated_at) VALUES ('company_logo',?,datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=datetime('now')`,[item.relative]);
    } else {
      run(`UPDATE ${item.table} SET ${item.column}=? WHERE ${item.idColumn}=?`,[item.relative,item.id]);
    }
  }
  console.log('Legacy files migrated. Run npm run integrity:check.');
} else console.log('Run again with --apply after reviewing this plan.');

db.close();
