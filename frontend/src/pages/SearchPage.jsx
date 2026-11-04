import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, BusFront, ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react';
import PageTransition from '../components/layout/PageTransition';
import SearchForm from '../components/search/SearchForm';
import FilterPanel from '../components/buses/FilterPanel';
import BusCard from '../components/buses/BusCard';
import { Button, EmptyState, Modal, Skeleton } from '../components/ui';
import { api } from '../api';
import { useBooking } from '../context/BookingContext';
import { dateLong, istDate, ymdToDate } from '../utils/format';

const SORTS = [
  ['departure', 'Earliest departure'],
  ['price', 'Lowest price'],
  ['duration', 'Shortest journey'],
  ['seats', 'Most seats'],
];

const addDays = (ymd, n) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { update } = useBooking();
  const from = params.get('from');
  const to = params.get('to');
  const date = params.get('date') || istDate(1);
  const [sort, setSort] = useState('departure');
  const [filters, setFilters] = useState({});
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const query = useMemo(() => {
    const q = { from, to, date, sort, page, pageSize: 10 };
    for (const k of ['acType', 'seatClass', 'departure', 'operators']) if (filters[k]?.length) q[k] = filters[k].join(',');
    if (filters.maxPrice) q.maxPrice = filters.maxPrice;
    return q;
  }, [from, to, date, sort, filters, page]);

  useEffect(() => {
    setPage(1);
  }, [from, to, date, sort, filters]);

  useEffect(() => {
    if (!from || !to) return;
    let alive = true;
    setLoading(true);
    setError(null);
    api.searchBuses(query)
      .then((r) => alive && setResult(r))
      .catch((e) => alive && setError(e))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [query, from, to]);

  const setDate = (d) => setParams({ from, to, date: d });
  const select = (item) => {
    update({ schedule: item, selectedSeats: [], passengers: {} });
    navigate(`/book/${item.id}/seats`);
  };

  const dates = [-1, 0, 1, 2, 3].map((n) => addDays(date, n)).filter((d) => d >= istDate(0));

  return (
    <PageTransition className="pb-10">
      <div className="border-b border-slate-200 bg-white py-5">
        <div className="container-page">
          <SearchForm compact initial={{ from, to, date }} key={`${from}-${to}-${date}`} />
        </div>
      </div>

      <div className="container-page mt-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-extrabold">
              {result?.origin?.name || from} <ArrowRight className="h-5 w-5 text-ink-500" /> {result?.destination?.name || to}
            </h1>
            <p className="text-sm text-ink-500">
              {dateLong(ymdToDate(date))} · {loading ? 'Searching…' : `${result?.total ?? 0} buses found`}
            </p>
          </div>
          <div className="flex gap-1.5 overflow-x-auto">
            {dates.map((d) => (
              <button
                key={d}
                onClick={() => setDate(d)}
                className={`chip shrink-0 ${d === date ? 'border-ink-900 bg-ink-900 text-white' : 'border-slate-200 bg-white text-ink-700 hover:border-slate-300'}`}
              >
                {new Date(`${d}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <div className="hidden lg:block">
            <div className="sticky top-20">
              <FilterPanel filters={filters} setFilters={setFilters} facets={result?.facets} />
            </div>
          </div>

          <div>
            <div className="mb-4 flex items-center gap-2 overflow-x-auto">
              <Button variant="secondary" size="sm" icon={SlidersHorizontal} className="lg:hidden" onClick={() => setFiltersOpen(true)}>
                Filters
              </Button>
              <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-ink-500">Sort by</span>
              {SORTS.map(([k, l]) => (
                <button key={k} onClick={() => setSort(k)} className={`chip shrink-0 ${sort === k ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-ink-700'}`}>
                  {l}
                </button>
              ))}
            </div>

            {error && <EmptyState icon={BusFront} title="Couldn't load buses">{error.message}</EmptyState>}
            {loading && !result && (
              <div className="space-y-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-40" />)}</div>
            )}
            {!error && result && (
              <div className={`space-y-4 transition-opacity ${loading ? 'opacity-50' : ''}`}>
                <AnimatePresence>
                  {result.items.map((item, i) => (
                    <BusCard key={item.id} item={item} index={i} onSelect={select} />
                  ))}
                </AnimatePresence>
                {result.items.length === 0 && !loading && (
                  <EmptyState
                    icon={BusFront}
                    title="No buses match"
                    action={<Button variant="secondary" onClick={() => (Object.keys(filters).length ? setFilters({}) : setDate(addDays(date, 1)))}>{Object.keys(filters).length ? 'Clear filters' : 'Try next day'}</Button>}
                  >
                    {Object.keys(filters).length ? 'Try removing some filters.' : 'There are no departures on this date. Try another day.'}
                  </EmptyState>
                )}
                {result.totalPages > 1 && (
                  <motion.div layout className="flex items-center justify-center gap-3 pt-2">
                    <Button variant="secondary" size="sm" icon={ChevronLeft} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
                    <span className="text-sm font-semibold text-ink-500">Page {result.page} of {result.totalPages}</span>
                    <Button variant="secondary" size="sm" disabled={page >= result.totalPages} onClick={() => setPage((p) => p + 1)}>Next <ChevronRight className="h-4 w-4" /></Button>
                  </motion.div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filters">
        <FilterPanel filters={filters} setFilters={setFilters} facets={result?.facets} />
        <Button className="mt-4 w-full" onClick={() => setFiltersOpen(false)}>Show {result?.total ?? 0} buses</Button>
      </Modal>
    </PageTransition>
  );
}
