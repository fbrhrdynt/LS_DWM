function integerFrom(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback;
  const number = Number(String(value).trim().replace(',', '.'));
  if (!Number.isFinite(number)) return fallback;
  return Math.trunc(number);
}

export function formatReportNumber(value, fallback = '-') {
  const number = integerFrom(value, null);
  if (number === null) return String(fallback);
  return String(number);
}

export function nextReportNumber(sourceValue, projectMaxValue = 0) {
  const source = integerFrom(sourceValue, 0);
  const projectMax = integerFrom(projectMaxValue, 0);
  return Math.max(1, source + 1, projectMax + 1);
}

export function nextReportDate(value) {
  const text = String(value ?? '').trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  date.setUTCDate(date.getUTCDate() + 1);
  return [
    String(date.getUTCFullYear()).padStart(4, '0'),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0')
  ].join('-');
}
