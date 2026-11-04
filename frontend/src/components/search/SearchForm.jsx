import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeftRight, Navigation, MapPin, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../api';
import { istDate } from '../../utils/format';
import CityCombobox from './CityCombobox';
import DatePicker from './DatePicker';
import { Button, Skeleton } from '../ui';

/** Origin / destination / date search. Cities are loaded from the API. */
export default function SearchForm({ initial = {}, compact = false }) {
  const navigate = useNavigate();
  const [cities, setCities] = useState(null);
  const [from, setFrom] = useState(null);
  const [to, setTo] = useState(null);
  const [date, setDate] = useState(initial.date || istDate(1));
  const [swapTurn, setSwapTurn] = useState(0);

  useEffect(() => {
    api.cities()
      .then((list) => {
        setCities(list);
        const find = (v) => list.find((c) => String(c.id) === String(v) || c.slug === v);
        setFrom(find(initial.from)?.id ?? null);
        setTo(find(initial.to)?.id ?? null);
      })
      .catch((e) => toast.error(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.from, initial.to]);

  const swap = () => {
    setFrom(to);
    setTo(from);
    setSwapTurn((t) => t + 1);
  };

  const submit = (e) => {
    e.preventDefault();
    if (!from || !to) return toast.error('Please choose both origin and destination');
    if (from === to) return toast.error('Origin and destination must be different');
    const slug = (id) => cities.find((c) => c.id === id).slug;
    navigate(`/buses?from=${slug(from)}&to=${slug(to)}&date=${date}`);
  };

  if (!cities) return <Skeleton className={compact ? 'h-20' : 'h-24'} />;

  return (
    <form onSubmit={submit} className={`card relative grid grid-cols-1 items-stretch divide-y divide-slate-200 p-2 md:grid-cols-[1fr_auto_1fr_1.2fr_auto] md:divide-x md:divide-y-0 ${compact ? '' : 'shadow-xl shadow-slate-900/5'}`}>
      <CityCombobox label="From" icon={Navigation} cities={cities} value={from} onChange={setFrom} exclude={to} placeholder="Leaving from" />
      <div className="relative flex items-center justify-center !border-0 md:w-0">
        <motion.button
          type="button"
          onClick={swap}
          animate={{ rotate: swapTurn * 180 }}
          whileHover={{ scale: 1.08 }}
          className="absolute z-10 grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-ink-700 shadow-md hover:text-brand-600"
          aria-label="Swap origin and destination"
        >
          <ArrowLeftRight className="h-4 w-4" />
        </motion.button>
      </div>
      <CityCombobox label="To" icon={MapPin} cities={cities} value={to} onChange={setTo} exclude={from} placeholder="Going to" />
      <DatePicker value={date} onChange={setDate} />
      <div className="flex items-center p-2 !border-0 md:pl-3">
        <Button type="submit" size="lg" icon={Search} className="w-full md:w-auto">
          Search buses
        </Button>
      </div>
    </form>
  );
}
