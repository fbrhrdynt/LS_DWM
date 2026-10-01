import { all, get, run } from '../config/db.js';

export const DEFAULT_REPORT_SETTINGS = Object.freeze({
  report_title_template: 'DWM DAILY REPORT NO. {report_no}',
  company_header_line_1: 'PT Step Oiltools, Graha Inti Fauzi 12th Floor',
  company_header_line_2: 'Jl. Buncit Raya No. 22 Jakarta 12510 - Indonesia Tel: +62 21 7943352',
  company_logo: ''
});

export function getReportSettings() {
  const rows = all(
    `SELECT key, value
     FROM app_settings
     WHERE key IN ('report_title_template', 'company_header_line_1', 'company_header_line_2', 'company_logo')`
  );

  const values = { ...DEFAULT_REPORT_SETTINGS };
  for (const row of rows) {
    if (Object.hasOwn(values, row.key)) values[row.key] = row.value ?? '';
  }
  return values;
}

export function setReportSetting(key, value) {
  if (!Object.hasOwn(DEFAULT_REPORT_SETTINGS, key)) {
    throw new Error(`Unsupported report setting: ${key}`);
  }

  run(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       updated_at = datetime('now')`,
    [key, String(value ?? '')]
  );
}

export function buildReportTitle(settings, reportNumber) {
  const template = String(
    settings?.report_title_template || DEFAULT_REPORT_SETTINGS.report_title_template
  ).trim();

  if (template.includes('{report_no}')) {
    return template.replaceAll('{report_no}', String(reportNumber));
  }

  return `${template} ${reportNumber}`.trim();
}

export function getCompanyLogoSetting() {
  return get('SELECT value FROM app_settings WHERE key = ? LIMIT 1', ['company_logo'])?.value || '';
}
