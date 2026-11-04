import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

const STEPS = ['Seats', 'Passengers', 'Review', 'Payment'];

export default function Stepper({ current }) {
  return (
    <ol className="flex items-center gap-2 sm:gap-3">
      {STEPS.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s} className="flex flex-1 items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2">
              <motion.span
                layout
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${done ? 'bg-green-600 text-white' : active ? 'bg-brand-600 text-white ring-4 ring-brand-100' : 'bg-slate-200 text-ink-500'}`}
              >
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </motion.span>
              <span className={`hidden text-sm font-semibold sm:inline ${active ? 'text-ink-900' : 'text-ink-500'}`}>{s}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="h-0.5 flex-1 overflow-hidden rounded bg-slate-200">
                <motion.div className="h-full bg-green-600" initial={false} animate={{ width: done ? '100%' : '0%' }} transition={{ duration: 0.4 }} />
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
