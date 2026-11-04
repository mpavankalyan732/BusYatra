// All schedules are operated in Indian Standard Time (UTC+05:30).
export const IST_OFFSET_MIN = 330;
const DAY_MS = 24 * 3600 * 1000;

/** 'YYYY-MM-DD' (IST) -> [startUtc, endUtc) or null if invalid */
export function istDayRange(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr || '')) return null;
  const start = new Date(`${dateStr}T00:00:00+05:30`);
  if (Number.isNaN(start.getTime())) return null;
  return [start, new Date(start.getTime() + DAY_MS)];
}

const shift = (date) => new Date(new Date(date).getTime() + IST_OFFSET_MIN * 60000);

/** Date -> 'YYYY-MM-DD' in IST */
export const toIstDateString = (date) => shift(date).toISOString().slice(0, 10);

/** Date -> hour of day (0-23) in IST */
export const istHour = (date) => shift(date).getUTCHours();

/** Date -> 'HH:mm' in IST */
export const istHHmm = (date) => shift(date).toISOString().slice(11, 16);

/** 'YYYY-MM-DD' + 'HH:mm' (IST) -> Date */
export const istDateTime = (dateStr, hhmm) => new Date(`${dateStr}T${hhmm}:00+05:30`);

export function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const todayIst = () => toIstDateString(new Date());

const fmt = (date, opts) => new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', ...opts }).format(new Date(date));
export const formatIstDate = (d) => fmt(d, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
export const formatIstTime = (d) => fmt(d, { hour: '2-digit', minute: '2-digit', hour12: false });
export const formatIstDateTime = (d) => `${formatIstDate(d)}, ${formatIstTime(d)}`;
