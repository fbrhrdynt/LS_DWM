import fs from 'node:fs';
import path from 'node:path';
import { databasePath } from '../config/db.js';
import { uploadRoot } from './file-storage.js';
import { integrityReport } from './integrity.service.js';
import { mailConfiguration } from './mail.service.js';
import { webDavConfig } from './webdav.service.js';

function size(file) { try { return fs.statSync(file).size; } catch { return 0; } }
function dirSize(root) {
  if (!fs.existsSync(root)) return 0;
  let total=0;
  for (const entry of fs.readdirSync(root,{withFileTypes:true})) {
    const p=path.join(root,entry.name); if(entry.isDirectory()) total+=dirSize(p); else if(entry.isFile()) total+=size(p);
  }
  return total;
}
function formatBytes(bytes) {
  const n=Number(bytes||0); if(n<1024) return `${n} B`; const units=['KB','MB','GB','TB']; let v=n/1024, i=0;
  while(v>=1024 && i<units.length-1){v/=1024;i++;} return `${v.toFixed(v>=10?1:2)} ${units[i]}`;
}
export function systemDiagnostics() {
  const root=process.cwd();
  let disk=null;
  try { const st=fs.statfsSync(root); disk={freeBytes:Number(st.bavail)*Number(st.bsize), totalBytes:Number(st.blocks)*Number(st.bsize)}; } catch {}
  const integrity=integrityReport();
  const mail=mailConfiguration(); const webdav=webDavConfig();
  const backupRoot=path.join(root,'backups');
  const backups=fs.existsSync(backupRoot)?fs.readdirSync(backupRoot).filter(n=>/^dwm-full-/.test(n)).sort().reverse().slice(0,10):[];
  return {
    node:process.version, platform:`${process.platform} ${process.arch}`, uptimeSeconds:Math.floor(process.uptime()),
    database:{path:databasePath, bytes:size(databasePath), display:formatBytes(size(databasePath)), walBytes:size(`${databasePath}-wal`)},
    uploads:{path:uploadRoot, bytes:dirSize(uploadRoot), display:formatBytes(dirSize(uploadRoot))},
    disk:disk?{...disk,free:formatBytes(disk.freeBytes),total:formatBytes(disk.totalBytes)}:null,
    integrity, mail:{configured:mail.configured,host:mail.host||'-'}, webdav:{configured:webdav.configured,baseUri:webdav.baseUri||'-',backupPath:webdav.backupPath}, backups
  };
}
