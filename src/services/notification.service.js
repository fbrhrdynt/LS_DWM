import { all } from '../config/db.js';
import { dateDiffDays, todayInTimeZone } from './maintenance-calculations.js';

function severityForDays(days) {
  if (days === null) return 'info';
  if (days < 0) return 'critical';
  if (days <= 7) return 'high';
  return 'warning';
}

function labelForDays(days, noun = 'Due') {
  if (days === null) return noun;
  if (days < 0) return `Overdue ${Math.abs(days)} day(s)`;
  if (days === 0) return `${noun} today`;
  return `${noun} in ${days} day(s)`;
}

export function listNotifications({ warningDays = 30, limit = 200 } = {}) {
  const today = todayInTimeZone();
  const notifications = [];

  const inspections = all(`
    SELECT i.id, i.id_asset_list, i.inspection_exp, i.inspection_date,
           a.asset_name, a.company_asset, c.name_inspection
    FROM inspection_detail i
    JOIN assets_list a ON a.id = i.id_asset_list
    LEFT JOIN inspection_category c ON c.id_inspection = i.id_inspection
    WHERE i.inspection_exp IS NOT NULL
      AND date(i.inspection_exp) <= date(?, ?)
    ORDER BY date(i.inspection_exp) ASC, i.id ASC
  `, [today, `+${Math.max(1, Number(warningDays)||30)} day`]);

  for (const row of inspections) {
    const days = dateDiffDays(today, row.inspection_exp);
    notifications.push({
      type: 'inspection',
      severity: severityForDays(days),
      days,
      dueDate: row.inspection_exp,
      title: `${row.name_inspection || 'Inspection'} · ${row.company_asset || row.asset_name}`,
      message: labelForDays(days, 'Expires'),
      href: `/assets/${row.id_asset_list}`
    });
  }

  const maintenance = all(`
    SELECT pm.id, pm.id_asset_list, pm.pm_due, pm.pm_status,
           a.asset_name, a.company_asset, c.pm_name
    FROM pm_details pm
    JOIN assets_list a ON a.id = pm.id_asset_list
    LEFT JOIN pm_detail_category c ON c.id = pm.id_pm_detail_category
    WHERE pm.pm_due IS NOT NULL
      AND COALESCE(pm.pm_status, '') NOT IN ('Completed', 'Cancelled')
      AND date(pm.pm_due) <= date(?, ?)
    ORDER BY date(pm.pm_due) ASC, pm.id ASC
  `, [today, `+${Math.max(1, Number(warningDays)||30)} day`]);

  for (const row of maintenance) {
    const days = dateDiffDays(today, row.pm_due);
    notifications.push({
      type: 'maintenance',
      severity: severityForDays(days),
      days,
      dueDate: row.pm_due,
      title: `${row.pm_name || 'Preventive Maintenance'} · ${row.company_asset || row.asset_name}`,
      message: labelForDays(days, 'Due'),
      href: `/assets/${row.id_asset_list}`
    });
  }

  const order = { critical: 0, high: 1, warning: 2, info: 3 };
  notifications.sort((a,b) => (order[a.severity]-order[b.severity]) || ((a.days ?? 99999)-(b.days ?? 99999)) || a.title.localeCompare(b.title));
  return notifications.slice(0, Math.min(500, Math.max(1, Number(limit)||200)));
}

export function notificationSummary() {
  const today = todayInTimeZone();
  const inspection = all(`
    SELECT inspection_exp AS due_date
    FROM inspection_detail
    WHERE inspection_exp IS NOT NULL
      AND date(inspection_exp) <= date(?, '+30 day')
  `, [today]);
  const maintenance = all(`
    SELECT pm_due AS due_date
    FROM pm_details
    WHERE pm_due IS NOT NULL
      AND COALESCE(pm_status, '') NOT IN ('Completed', 'Cancelled')
      AND date(pm_due) <= date(?, '+30 day')
  `, [today]);

  let overdue = 0;
  let due7 = 0;
  let due30 = 0;
  for (const row of [...inspection, ...maintenance]) {
    const days = dateDiffDays(today, row.due_date);
    if (days === null) continue;
    if (days < 0) overdue++;
    else if (days <= 7) due7++;
    else if (days <= 30) due30++;
  }
  return { total: overdue + due7 + due30, overdue, due7, due30 };
}
