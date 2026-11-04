/**
 * Small natural-language date parser for the mock agent (IST).
 * Understands: today, tomorrow, day after tomorrow, in N days, next/this <weekday>,
 * <weekday>, 2026-11-12, 12/11/2026, 12-11, 12 Nov, Nov 12, 12th November.
 */
import { addDays, todayIst } from '../../lib/time.js';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const pad = (n) => String(n).padStart(2, '0');

function build(y, m, d) {
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** Year inference: if the date already passed this year, assume next year. */
function withYear(m, d, today) {
  const y = Number(today.slice(0, 4));
  const candidate = build(y, m, d);
  if (candidate && candidate < today) return build(y + 1, m, d);
  return candidate;
}

export function parseDate(text, today = todayIst()) {
  const t = String(text || '').toLowerCase();

  if (/\bday after tomorrow\b/.test(t)) return addDays(today, 2);
  if (/\btomorrow\b|\btmrw\b|\btmr\b/.test(t)) return addDays(today, 1);
  if (/\btoday\b|\btonight\b/.test(t)) return today;
  let m = t.match(/\bin (\d{1,2}) days?\b/);
  if (m) return addDays(today, Number(m[1]));

  m = t.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (m) return build(Number(m[1]), Number(m[2]), Number(m[3]));

  m = t.match(/\b(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?\b/);
  if (m) {
    const y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : null;
    return y ? build(y, Number(m[2]), Number(m[1])) : withYear(Number(m[2]), Number(m[1]), today);
  }

  m = t.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([a-z]{3,9})\b/);
  if (m && MONTHS.includes(m[2].slice(0, 3))) return withYear(MONTHS.indexOf(m[2].slice(0, 3)) + 1, Number(m[1]), today);
  m = t.match(/\b([a-z]{3,9})\s+(\d{1,2})(?:st|nd|rd|th)?\b/);
  if (m && MONTHS.includes(m[1].slice(0, 3))) return withYear(MONTHS.indexOf(m[1].slice(0, 3)) + 1, Number(m[2]), today);

  const dayIdx = DAYS.findIndex((d) => new RegExp(`\\b${d}\\b`).test(t));
  if (dayIdx >= 0) {
    const cur = new Date(`${today}T00:00:00Z`).getUTCDay();
    // "friday" / "next friday" -> the upcoming Friday (a week ahead if today is Friday)
    const diff = (dayIdx - cur + 7) % 7 || 7;
    return addDays(today, diff);
  }
  return null;
}
