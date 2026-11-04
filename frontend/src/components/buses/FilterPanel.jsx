import { Moon, Sun, Sunrise, Sunset, RotateCcw } from 'lucide-react';

const SLOTS = [
  { key: 'MORNING', label: '6 AM–12 PM', icon: Sunrise },
  { key: 'AFTERNOON', label: '12–6 PM', icon: Sun },
  { key: 'EVENING', label: '6 PM–12 AM', icon: Sunset },
  { key: 'NIGHT', label: 'Before 6 AM', icon: Moon },
];

const Toggle = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`chip justify-center ${active ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-ink-700 hover:border-slate-300'}`}
  >
    {children}
  </button>
);

/** Filters are plain state; parent turns them into API query params. */
export default function FilterPanel({ filters, setFilters, facets }) {
  const toggle = (key, value) =>
    setFilters((f) => {
      const list = f[key] || [];
      return { ...f, [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] };
    });
  const has = (key, v) => (filters[key] || []).includes(v);
  const activeCount = ['acType', 'seatClass', 'departure', 'operators'].reduce((n, k) => n + (filters[k]?.length || 0), 0) + (filters.maxPrice ? 1 : 0);

  return (
    <aside className="card space-y-6 p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-bold">Filters {activeCount > 0 && <span className="ml-1 rounded-full bg-brand-600 px-2 py-0.5 text-xs text-white">{activeCount}</span>}</h3>
        {activeCount > 0 && (
          <button onClick={() => setFilters({})} className="flex items-center gap-1 text-xs font-semibold text-brand-600">
            <RotateCcw className="h-3 w-3" /> Clear
          </button>
        )}
      </div>

      <section>
        <p className="label">Bus type</p>
        <div className="grid grid-cols-2 gap-2">
          <Toggle active={has('acType', 'AC')} onClick={() => toggle('acType', 'AC')}>A/C</Toggle>
          <Toggle active={has('acType', 'NON_AC')} onClick={() => toggle('acType', 'NON_AC')}>Non A/C</Toggle>
          <Toggle active={has('seatClass', 'SLEEPER')} onClick={() => toggle('seatClass', 'SLEEPER')}>Sleeper</Toggle>
          <Toggle active={has('seatClass', 'SEATER')} onClick={() => toggle('seatClass', 'SEATER')}>Seater</Toggle>
          <Toggle active={has('seatClass', 'SEMI_SLEEPER')} onClick={() => toggle('seatClass', 'SEMI_SLEEPER')}>Semi-sleeper</Toggle>
        </div>
      </section>

      <section>
        <p className="label">Departure time</p>
        <div className="grid grid-cols-2 gap-2">
          {SLOTS.map((s) => (
            <Toggle key={s.key} active={has('departure', s.key)} onClick={() => toggle('departure', s.key)}>
              <s.icon className="h-3.5 w-3.5" /> {s.label}
            </Toggle>
          ))}
        </div>
      </section>

      {facets?.maxFare > 0 && (
        <section>
          <p className="label">Max price: ₹{filters.maxPrice || Math.ceil(facets.maxFare / 100)}</p>
          <input
            type="range"
            className="w-full accent-brand-600"
            min={Math.floor(facets.minFare / 100)}
            max={Math.ceil(facets.maxFare / 100)}
            step={10}
            value={filters.maxPrice || Math.ceil(facets.maxFare / 100)}
            onChange={(e) => setFilters((f) => ({ ...f, maxPrice: Number(e.target.value) }))}
          />
          <div className="flex justify-between text-xs text-ink-500">
            <span>₹{Math.floor(facets.minFare / 100)}</span>
            <span>₹{Math.ceil(facets.maxFare / 100)}</span>
          </div>
        </section>
      )}

      {facets?.operators?.length > 0 && (
        <section>
          <p className="label">Operators</p>
          <div className="space-y-2">
            {facets.operators.map((op) => (
              <label key={op} className="flex cursor-pointer items-center gap-2.5 text-sm">
                <input type="checkbox" className="h-4 w-4 rounded accent-brand-600" checked={has('operators', op)} onChange={() => toggle('operators', op)} />
                {op}
              </label>
            ))}
          </div>
        </section>
      )}
    </aside>
  );
}
