/**
 * Parse a DD.MM.YYYY date string (Indian convention) into a Date object.
 * Also tolerates DD-MM-YYYY and DD/MM/YYYY. Returns null for empty or unparseable input.
 * Constructs the Date in UTC to avoid timezone drift across hosts.
 *
 * Always use this on values coming out of the source spreadsheet — never `new Date(s)` directly.
 */
export function parseDate(input) {
  if (input === null || input === undefined) return null;
  const s = String(input).trim();
  if (!s) return null;
  const lower = s.toLowerCase();
  if (lower === 'nan' || lower === 'test' || lower === 'null') return null;

  const m = s.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/);
  if (!m) return null;

  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return null;

  // Round-trip check rejects impossible dates like 31.02.2020.
  if (date.getUTCDate() !== day || date.getUTCMonth() !== month - 1) return null;

  return date;
}
