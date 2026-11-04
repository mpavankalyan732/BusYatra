import { motion } from 'framer-motion';
import { Armchair, BedSingle } from 'lucide-react';
import { Field } from '../ui';

const GENDERS = [['MALE', 'Male'], ['FEMALE', 'Female'], ['OTHER', 'Other']];

export default function PassengerForm({ index, seat, value, onChange, errors = {} }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e?.target ? e.target.value : e });
  const Icon = seat.deck === 'UPPER' || seat.seatNumber.match(/^[LU]\d/) ? BedSingle : Armchair;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="card p-5"
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-bold">Passenger {index + 1}</h3>
        <span className="flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
          <Icon className="h-3.5 w-3.5" /> Seat {seat.seatNumber}
        </span>
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_110px]">
        <Field label="Full name" error={errors.name}>
          <input className="input" value={value.name || ''} onChange={set('name')} placeholder="As on ID proof" autoComplete="name" maxLength={80} />
        </Field>
        <Field label="Age" error={errors.age}>
          <input className="input" type="number" inputMode="numeric" min={1} max={120} value={value.age || ''} onChange={set('age')} placeholder="Age" />
        </Field>
      </div>
      <div className="mt-4">
        <span className="label">Gender</span>
        <div className="grid grid-cols-3 gap-2">
          {GENDERS.map(([k, l]) => (
            <button
              type="button"
              key={k}
              onClick={() => set('gender')(k)}
              className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${value.gender === k ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-300 hover:border-slate-400'}`}
            >
              {l}
            </button>
          ))}
        </div>
        {errors.gender && <span className="mt-1 block text-xs font-medium text-red-600">{errors.gender}</span>}
      </div>
    </motion.div>
  );
}
