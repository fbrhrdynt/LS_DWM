function parseIsoDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return null;
  return { year, month, day };
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function formatDate(year, month, day) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function calculatePmDue(startDate, frequency, unit) {
  const parsed = parseIsoDate(startDate);
  const amount = Number(frequency);
  const normalizedUnit = String(unit || '').trim();

  if (!parsed || !Number.isFinite(amount) || amount < 1 || !['Day', 'Week', 'Month', 'Year'].includes(normalizedUnit)) {
    return null;
  }

  const integerAmount = Math.floor(amount);
  let { year, month, day } = parsed;

  if (normalizedUnit === 'Day' || normalizedUnit === 'Week') {
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() + integerAmount * (normalizedUnit === 'Week' ? 7 : 1));
    return formatDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }

  if (normalizedUnit === 'Month') {
    const zeroBased = (month - 1) + integerAmount;
    year += Math.floor(zeroBased / 12);
    month = ((zeroBased % 12) + 12) % 12 + 1;
    day = Math.min(day, daysInMonth(year, month));
    return formatDate(year, month, day);
  }

  year += integerAmount;
  day = Math.min(day, daysInMonth(year, month));
  return formatDate(year, month, day);
}

export function todayInTimeZone(timeZone = process.env.APP_TIMEZONE || 'Asia/Jakarta') {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function dateDiffDays(fromIso, toIso) {
  const from = parseIsoDate(fromIso);
  const to = parseIsoDate(toIso);
  if (!from || !to) return null;
  const a = Date.UTC(from.year, from.month - 1, from.day);
  const b = Date.UTC(to.year, to.month - 1, to.day);
  return Math.round((b - a) / 86400000);
}

export function dueState(dueDate, { completed = false, today = todayInTimeZone(), warningDays = 30 } = {}) {
  if (completed) return { key: 'completed', label: 'Completed', days: null };
  const days = dateDiffDays(today, dueDate);
  if (days === null) return { key: 'unknown', label: 'No due date', days: null };
  if (days < 0) return { key: 'expired', label: `Overdue ${Math.abs(days)}d`, days };
  if (days === 0) return { key: 'due', label: 'Due today', days };
  if (days <= warningDays) return { key: 'warning', label: `Due in ${days}d`, days };
  return { key: 'valid', label: 'Valid', days };
}
