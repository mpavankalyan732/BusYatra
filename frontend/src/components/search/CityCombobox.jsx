import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MapPin } from 'lucide-react';

/** Searchable city dropdown with keyboard support. `value` is a city id. */
export default function CityCombobox({ label, cities, value, onChange, exclude, icon: Icon = MapPin, placeholder }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const ref = useRef(null);
  const selected = cities.find((c) => c.id === value);

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cities.filter((c) => c.id !== exclude && (!q || c.name.toLowerCase().includes(q) || c.state.toLowerCase().includes(q)));
  }, [cities, query, exclude]);

  useEffect(() => {
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  useEffect(() => {
    setActive(0);
  }, [query, open]);

  const choose = (c) => {
    onChange(c.id);
    setQuery('');
    setOpen(false);
  };

  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, options.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    if (e.key === 'Enter' && open && options[active]) { e.preventDefault(); choose(options[active]); }
    if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <label className="flex cursor-text items-center gap-3 rounded-2xl px-4 py-3 transition hover:bg-slate-50">
        <Icon className="h-5 w-5 shrink-0 text-ink-500" />
        <div className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-ink-500">{label}</span>
          <input
            role="combobox"
            aria-expanded={open}
            className="w-full bg-transparent text-base font-bold text-ink-900 outline-none placeholder:font-medium placeholder:text-slate-400"
            placeholder={selected ? selected.name : placeholder}
            value={open ? query : selected?.name || ''}
            onFocus={() => setOpen(true)}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onKeyDown={onKey}
          />
        </div>
      </label>
      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-full z-30 mt-2 max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl"
            role="listbox"
          >
            {options.length === 0 && <li className="px-3 py-3 text-sm text-ink-500">No cities match “{query}”</li>}
            {options.map((c, i) => (
              <li
                key={c.id}
                role="option"
                aria-selected={c.id === value}
                onMouseDown={(e) => { e.preventDefault(); choose(c); }}
                onMouseEnter={() => setActive(i)}
                className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 ${i === active ? 'bg-brand-50' : ''}`}
              >
                <MapPin className="h-4 w-4 text-ink-500" />
                <div>
                  <p className="text-sm font-semibold">{c.name}</p>
                  <p className="text-xs text-ink-500">{c.state}</p>
                </div>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
