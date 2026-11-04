const TZ = 'Asia/Kolkata';

export const inr = (paise) =>
  `₹${(Number(paise || 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export const time = (d) => new Intl.DateTimeFormat('en-IN', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(d));
export const dateShort = (d) => new Intl.DateTimeFormat('en-IN', { timeZone: TZ, day: '2-digit', month: 'short' }).format(new Date(d));
export const dateLong = (d) => new Intl.DateTimeFormat('en-IN', { timeZone: TZ, weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(d));
export const dateTime = (d) => `${dateShort(d)}, ${time(d)}`;

/** 'YYYY-MM-DD' for "today" in IST, optionally offset by n days */
export function istDate(offsetDays = 0) {
  const d = new Date(Date.now() + 330 * 60000 + offsetDays * 864e5);
  return d.toISOString().slice(0, 10);
}
export const ymdToDate = (ymd) => new Date(`${ymd}T12:00:00+05:30`);

export const duration = (mins) => `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;

export const busTypeLabel = (bus) =>
  `${bus.acType === 'AC' ? 'A/C' : 'Non A/C'} ${{ SEATER: 'Seater', SEMI_SLEEPER: 'Semi-Sleeper', SLEEPER: 'Sleeper' }[bus.seatClass] || ''}`;

export const titleCase = (s = '') => s.charAt(0) + s.slice(1).toLowerCase();

export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
