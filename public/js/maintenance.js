function parseIsoDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function formatDate(year, month, day) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function calculatePmDue(startDate, frequency, unit) {
  const parsed = parseIsoDate(startDate);
  const amount = Math.floor(Number(frequency));
  if (!parsed || !Number.isFinite(amount) || amount < 1) return '';

  let { year, month, day } = parsed;
  if (unit === 'Day' || unit === 'Week') {
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() + amount * (unit === 'Week' ? 7 : 1));
    return formatDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }

  if (unit === 'Month') {
    const target = month - 1 + amount;
    year += Math.floor(target / 12);
    month = ((target % 12) + 12) % 12 + 1;
    day = Math.min(day, daysInMonth(year, month));
    return formatDate(year, month, day);
  }

  if (unit === 'Year') {
    year += amount;
    day = Math.min(day, daysInMonth(year, month));
    return formatDate(year, month, day);
  }

  return '';
}

for (const form of document.querySelectorAll('[data-pm-form]')) {
  const category = form.querySelector('[data-pm-category]');
  const start = form.querySelector('[data-pm-start]');
  const due = form.querySelector('[data-pm-due]');

  const sync = () => {
    const option = category?.selectedOptions?.[0];
    if (!option || !start || !due) return;
    due.value = calculatePmDue(start.value, option.dataset.frequency, option.dataset.unit);
  };

  category?.addEventListener('change', sync);
  start?.addEventListener('input', sync);
  sync();
}

for (const form of document.querySelectorAll('[data-document-upload-form]')) {
  const category = form.querySelector('[data-document-category]');
  const syncAction = () => {
    if (!category?.value) return;
    form.action = `/maintenance/documents/${encodeURIComponent(category.value)}`;
  };
  category?.addEventListener('change', syncAction);
  syncAction();
}
