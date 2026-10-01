import { systemDiagnostics } from '../services/system-diagnostics.service.js';
import { repairSafeIntegrityIssues } from '../services/integrity.service.js';
import { testWebDav } from '../services/webdav.service.js';

function clean(v,max=400){return String(v??'').trim().slice(0,max);}
export function systemPage(req,res,next){try{res.render('settings/system',{title:'System',diagnostics:systemDiagnostics(),notice:clean(req.query.notice)});}catch(e){next(e);}}
export function repairIntegrity(req,res,next){try{const result=repairSafeIntegrityIssues({apply:true});res.redirect('/settings/system?notice='+encodeURIComponent(`Safe integrity repair applied: ${result.actions.length} action(s).`));}catch(e){next(e);}}
export async function webdavTest(req,res,next){try{const result=await testWebDav();res.redirect('/settings/system?notice='+encodeURIComponent(result.message));}catch(e){next(e);}}
