import 'dotenv/config';
import { all, get, run, db } from '../src/config/db.js';
import { normalizeUploadedLogo, resolveStoredUpload } from '../src/services/file-storage.js';

let changed = 0;
let skipped = 0;

for (const project of all(`SELECT id_project, logo FROM projects WHERE logo IS NOT NULL AND trim(logo) <> ''`)) {
  const absolute = resolveStoredUpload(project.logo);
  if (!absolute) {
    console.log(`SKIP project ${project.id_project}: legacy/external path ${project.logo}`);
    skipped++;
    continue;
  }

  try {
    const next = await normalizeUploadedLogo({ path: absolute });
    if (next && next !== project.logo) {
      run(`UPDATE projects SET logo = ?, updated_at = datetime('now') WHERE id_project = ?`, [next, project.id_project]);
      changed++;
      console.log(`OK project ${project.id_project}: ${next}`);
    } else {
      skipped++;
    }
  } catch (error) {
    console.error(`FAIL project ${project.id_project}: ${error.message}`);
  }
}

const company = get(`SELECT value FROM app_settings WHERE key = 'company_logo' LIMIT 1`);
if (company?.value) {
  const absolute = resolveStoredUpload(company.value);
  if (absolute) {
    try {
      const next = await normalizeUploadedLogo({ path: absolute });
      if (next && next !== company.value) {
        run(`UPDATE app_settings SET value = ?, updated_at = datetime('now') WHERE key = 'company_logo'`, [next]);
        changed++;
        console.log(`OK company logo: ${next}`);
      }
    } catch (error) {
      console.error(`FAIL company logo: ${error.message}`);
    }
  }
}

db.close();
console.log(`Logo normalization complete. Changed: ${changed}, skipped: ${skipped}.`);
