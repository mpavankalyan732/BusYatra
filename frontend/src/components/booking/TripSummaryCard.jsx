import { ArrowRight, MapPin } from 'lucide-react';
import { busTypeLabel, dateLong, duration, time } from '../../utils/format';

/** Compact journey header used across booking stages. */
export default function TripSummaryCard({ schedule, compact }) {
  if (!schedule) return null;
  const { route, bus } = schedule;
  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{dateLong(schedule.departureAt)}</p>
          <h3 className="mt-1 flex items-center gap-2 text-lg font-bold">
            {route.origin.name} <ArrowRight className="h-4 w-4 text-ink-500" /> {route.destination.name}
          </h3>
        </div>
        {bus && (
          <div className="text-right">
            <p className="font-semibold">{bus.operatorName}</p>
            <p className="text-xs text-ink-500">{busTypeLabel(bus)}</p>
          </div>
        )}
      </div>
      {!compact && (
        <div className="mt-4 grid grid-cols-3 items-center gap-2 rounded-xl bg-slate-50 p-3 text-center">
          <div>
            <p className="text-lg font-bold">{time(schedule.departureAt)}</p>
            <p className="flex items-center justify-center gap-1 text-xs text-ink-500"><MapPin className="h-3 w-3" />{route.boardingPoints?.[0]}</p>
          </div>
          <div className="text-xs font-semibold text-ink-500">
            <div className="mx-auto mb-1 h-px w-full bg-slate-300" />
            {duration(schedule.durationMinutes)}
          </div>
          <div>
            <p className="text-lg font-bold">{time(schedule.arrivalAt)}</p>
            <p className="flex items-center justify-center gap-1 text-xs text-ink-500"><MapPin className="h-3 w-3" />{route.droppingPoints?.[0]}</p>
          </div>
        </div>
      )}
    </div>
  );
}
