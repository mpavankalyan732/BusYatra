import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, MapPin, Star, Wifi, Zap, Droplets, Cctv, Lamp, BedDouble, Film } from 'lucide-react';
import { api } from '../../api';
import { busTypeLabel, duration, inr, time, dateShort } from '../../utils/format';
import { Badge, Button, Spinner } from '../ui';
import SeatLayout from '../seats/SeatLayout';

const AMENITY_ICONS = { WiFi: Wifi, 'Charging Point': Zap, 'Water Bottle': Droplets, CCTV: Cctv, 'Reading Light': Lamp, Blanket: BedDouble, Movie: Film };

export default function BusCard({ item, onSelect, index }) {
  const { bus, route } = item;
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const few = item.availableSeats > 0 && item.availableSeats <= 6;

  const toggle = async () => {
    setOpen((o) => !o);
    if (!preview) {
      try {
        setPreview(await api.seats(item.id));
      } catch {
        setPreview({ seats: [] });
      }
    }
  };

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.3) }}
      className="card overflow-hidden transition hover:border-slate-300 hover:shadow-md"
    >
      <div className="grid gap-4 p-5 md:grid-cols-[1.6fr_2fr_1fr] md:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold">{bus.operatorName}</h3>
            <Badge tone={bus.rating >= 4.3 ? 'green' : 'amber'}>
              <Star className="h-3 w-3 fill-current" /> {bus.rating.toFixed(1)}
            </Badge>
          </div>
          <p className="mt-0.5 text-sm text-ink-500">{busTypeLabel(bus)}</p>
          <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">{bus.serviceCode} · {bus.registrationNo}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {bus.amenities.slice(0, 4).map((a) => {
              const I = AMENITY_ICONS[a] || Zap;
              return (
                <span key={a} title={a} className="grid h-7 w-7 place-items-center rounded-lg bg-slate-100 text-ink-500">
                  <I className="h-3.5 w-3.5" />
                </span>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
          <div>
            <p className="text-xl font-extrabold">{time(item.departureAt)}</p>
            <p className="flex items-center gap-1 text-xs text-ink-500"><MapPin className="h-3 w-3" />{route.boardingPoints[0]}</p>
          </div>
          <div className="text-center text-xs font-semibold text-ink-500">
            <span>{duration(item.durationMinutes)}</span>
            <div className="relative mx-auto mt-1 h-px w-full bg-slate-300">
              <span className="absolute -top-1 left-0 h-2 w-2 rounded-full border-2 border-slate-300 bg-white" />
              <span className="absolute -top-1 right-0 h-2 w-2 rounded-full bg-slate-300" />
            </div>
          </div>
          <div className="text-right">
            <p className="text-xl font-extrabold">{time(item.arrivalAt)}</p>
            <p className="text-xs text-ink-500">
              {dateShort(item.arrivalAt) !== dateShort(item.departureAt) && <span className="mr-1 font-semibold text-brand-600">{dateShort(item.arrivalAt)}</span>}
              {route.droppingPoints[0]}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 md:flex-col md:items-end">
          <div className="md:text-right">
            <p className="text-xs text-ink-500">Starts from</p>
            <p className="text-2xl font-extrabold">{inr(item.baseFare)}</p>
            <p className={`text-xs font-semibold ${item.availableSeats === 0 ? 'text-red-600' : few ? 'text-amber-600' : 'text-green-700'}`}>
              {item.availableSeats === 0 ? 'Sold out' : `${item.availableSeats} seats left`}
            </p>
          </div>
          <Button onClick={() => onSelect(item)} disabled={item.availableSeats === 0}>
            Select seats
          </Button>
        </div>
      </div>

      <button onClick={toggle} className="flex w-full items-center justify-center gap-1.5 border-t border-slate-100 bg-slate-50/60 py-2 text-xs font-semibold text-ink-700 hover:bg-slate-100">
        Seat layout preview & amenities <motion.span animate={{ rotate: open ? 180 : 0 }}><ChevronDown className="h-4 w-4" /></motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="grid gap-6 border-t border-slate-100 p-5 md:grid-cols-[auto_1fr]">
              <div>{preview ? <SeatLayout seats={preview.seats} readOnly mini /> : <Spinner />}</div>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="label">Boarding points</p>
                  <p>{route.boardingPoints.join(' · ')}</p>
                </div>
                <div>
                  <p className="label">Dropping points</p>
                  <p>{route.droppingPoints.join(' · ')}</p>
                </div>
                <div>
                  <p className="label">Amenities</p>
                  <p>{bus.amenities.join(' · ') || '—'}</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}
