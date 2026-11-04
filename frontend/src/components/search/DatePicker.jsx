import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { istDate } from '../../utils/format';

const WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ymd = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** Calendar popover with Today / Tomorrow quick picks. `value` is 'YYYY-MM-DD'. */
export default function DatePicker({ value, onChange, maxDays = 60 }) {
  const today = istDate(0);
  const max = istDate(maxDays);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => {
    const [y, m] = (value || today).split('-').map(Number);
    return { y, m: m - 1 };
  });
  const ref = useRef(null);

  useEffect(() => {
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const cells = useMemo(() => {
    const first = new Date(Date.UTC(view.y, view.m, 1)).getUTCDay();
    const days = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
    return [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  }, [view]);

  const shift = (n) => setView((v) => {
    const m = v.m + n;
    return { y: v.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 };
  });

  const display = value ? new Date(`${value}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) : 'Select date';

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition hover:bg-slate-50">
        <CalendarDays className="h-5 w-5 shrink-0 text-ink-500" />
        <div className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-ink-500">Date of journey</span>
          <span className="block truncate text-base font-bold">{display}</span>
        </div>
      </button>
      <div className="flex gap-1.5 px-4 pb-2 sm:absolute sm:right-3 sm:top-1/2 sm:-translate-y-1/2 sm:p-0">
        {[['Today', 0], ['Tomorrow', 1]].map(([l, n]) => (
          <button
            type="button"
            key={l}
            onClick={() => onChange(istDate(n))}
            className={`chip ${value === istDate(n) ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 text-ink-700 hover:border-slate-300'}`}
          >
            {l}
          </button>
        ))}
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full z-30 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <button type="button" onClick={() => shift(-1)} className="rounded-lg p-1.5 hover:bg-slate-100" aria-label="Previous month"><ChevronLeft className="h-5 w-5" /></button>
              <span className="font-bold">{MONTHS[view.m]} {view.y}</span>
              <button type="button" onClick={() => shift(1)} className="rounded-lg p-1.5 hover:bg-slate-100" aria-label="Next month"><ChevronRight className="h-5 w-5" /></button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-ink-500">
              {WEEK.map((w) => <span key={w} className="py-1">{w}</span>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((d, i) => {
                if (!d) return <span key={`e${i}`} />;
                const key = ymd(view.y, view.m, d);
                const disabled = key < today || key > max;
                const selected = key === value;
                return (
                  <button
                    type="button"
                    key={key}
                    disabled={disabled}
                    onClick={() => { onChange(key); setOpen(false); }}
                    className={`aspect-square rounded-xl text-sm font-semibold transition ${selected ? 'bg-brand-600 text-white shadow' : key === today ? 'text-brand-600 ring-1 ring-brand-200' : ''} ${disabled ? 'cursor-not-allowed text-slate-300' : selected ? '' : 'hover:bg-brand-50'}`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
