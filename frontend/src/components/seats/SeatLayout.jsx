import { motion } from 'framer-motion';
import { Armchair, BedSingle, CircleDot } from 'lucide-react';
import { inr } from '../../utils/format';

/** Steering wheel marker at the front of the lower deck */
const Driver = () => (
  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
    <CircleDot className="h-6 w-6 text-ink-500" strokeWidth={2.5} /> Driver
  </div>
);

function Seat({ seat, selected, onToggle, readOnly, mini }) {
  const unavailable = seat.status === 'booked' || seat.status === 'held';
  const sleeper = seat.kind === 'SLEEPER';
  const size = mini ? (sleeper ? 'h-9 w-5' : 'h-5 w-5') : sleeper ? 'h-[4.5rem] w-11' : 'h-11 w-11';
  const tone = unavailable
    ? 'cursor-not-allowed border-seat-booked/50 bg-slate-200 text-slate-400'
    : selected
      ? 'border-seat-selected bg-seat-selected text-white shadow-md shadow-blue-600/30'
      : 'border-seat-available bg-green-50 text-seat-available hover:bg-green-100';
  const Icon = sleeper ? BedSingle : Armchair;

  return (
    <motion.button
      type="button"
      disabled={unavailable || readOnly}
      onClick={() => onToggle?.(seat)}
      whileTap={readOnly || unavailable ? undefined : { scale: 0.88 }}
      animate={{ scale: selected ? 1.04 : 1 }}
      title={`${seat.seatNumber}${seat.isWindow ? ' · window' : ''} · ${unavailable ? 'not available' : inr(seat.fare)}`}
      aria-label={`Seat ${seat.seatNumber} ${unavailable ? 'booked' : selected ? 'selected' : 'available'}`}
      aria-pressed={selected}
      className={`relative flex flex-col items-center justify-center rounded-lg border-2 transition-colors ${size} ${tone} ${readOnly ? 'cursor-default' : ''}`}
    >
      {!mini && <Icon className="h-4 w-4" />}
      {!mini && <span className="mt-0.5 text-[10px] font-bold leading-none">{seat.seatNumber}</span>}
    </motion.button>
  );
}

function Deck({ name, seats, selectedIds, onToggle, readOnly, mini }) {
  const rows = Math.max(...seats.map((s) => s.row)) + 1;
  const cols = Math.max(...seats.map((s) => s.col)) + 1;
  const byPos = new Map(seats.map((s) => [`${s.row}-${s.col}`, s]));
  const gap = mini ? 'gap-1' : 'gap-2';

  return (
    <div className={`rounded-2xl border-2 border-slate-200 bg-white ${mini ? 'p-2' : 'p-4'}`}>
      <div className={`mb-3 flex items-center justify-between ${mini ? 'mb-1.5' : ''}`}>
        <span className={`font-bold uppercase tracking-wider text-ink-500 ${mini ? 'text-[9px]' : 'text-xs'}`}>{name === 'UPPER' ? 'Upper deck' : 'Lower deck'}</span>
        {!mini && name === 'LOWER' && <Driver />}
      </div>
      <div className={`grid ${gap}`} style={{ gridTemplateColumns: `repeat(${cols}, auto)` }}>
        {Array.from({ length: rows * cols }).map((_, i) => {
          const r = Math.floor(i / cols);
          const c = i % cols;
          const seat = byPos.get(`${r}-${c}`);
          if (!seat) return <div key={i} className={mini ? 'w-2' : 'w-5'} />; // aisle
          return <Seat key={seat.id} seat={seat} selected={selectedIds.includes(seat.id)} onToggle={onToggle} readOnly={readOnly} mini={mini} />;
        })}
      </div>
    </div>
  );
}

export default function SeatLayout({ seats, selectedIds = [], onToggle, readOnly, mini }) {
  const decks = ['LOWER', 'UPPER'].filter((d) => seats.some((s) => s.deck === d));
  return (
    <div className={`flex flex-wrap ${mini ? 'gap-2' : 'gap-5'}`}>
      {decks.map((d) => (
        <Deck key={d} name={d} seats={seats.filter((s) => s.deck === d)} selectedIds={selectedIds} onToggle={onToggle} readOnly={readOnly} mini={mini} />
      ))}
    </div>
  );
}

export function SeatLegend() {
  const item = (cls, label) => (
    <span className="flex items-center gap-2 text-xs font-medium text-ink-700">
      <span className={`h-4 w-4 rounded border-2 ${cls}`} /> {label}
    </span>
  );
  return (
    <div className="flex flex-wrap gap-4">
      {item('border-seat-available bg-green-50', 'Available')}
      {item('border-seat-selected bg-seat-selected', 'Selected')}
      {item('border-seat-booked/50 bg-slate-200', 'Booked')}
    </div>
  );
}
