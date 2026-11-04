import { Bus, MapPin } from 'lucide-react';
import { Badge, statusTone } from '../ui';
import { busTypeLabel, dateLong, duration, inr, time, titleCase } from '../../utils/format';

/** E-ticket visual (the PDF is generated server-side with the same data). */
export default function TicketView({ b }) {
  const s = b.schedule;
  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-xl shadow-slate-900/10 ring-1 ring-slate-200">
      <div className="flex items-center justify-between bg-gradient-to-r from-brand-600 to-brand-700 px-6 py-5 text-white">
        <div className="flex items-center gap-2 text-lg font-extrabold"><Bus className="h-5 w-5" /> BusYatra e-Ticket</div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wider text-white/70">Booking ID</p>
          <p className="font-mono text-lg font-bold tracking-wide">{b.bookingCode}</p>
        </div>
      </div>

      <div className="p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={statusTone(b.status)}>{b.status}</Badge>
          <Badge tone={statusTone(b.paymentStatus)}>Payment: {b.paymentStatus}</Badge>
          {b.rescheduleCount > 0 && <Badge tone="blue">Rescheduled ×{b.rescheduleCount}</Badge>}
        </div>

        <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <div>
            <p className="text-2xl font-extrabold">{time(s.departureAt)}</p>
            <p className="font-semibold">{s.route.origin.name}</p>
            <p className="flex items-center gap-1 text-xs text-ink-500"><MapPin className="h-3 w-3" /> {s.route.boardingPoints[0]}</p>
          </div>
          <div className="text-center text-xs font-semibold text-ink-500">
            {duration(s.durationMinutes)}
            <div className="mt-1 h-px w-16 bg-slate-300 sm:w-28" />
          </div>
          <div className="text-right">
            <p className="text-2xl font-extrabold">{time(s.arrivalAt)}</p>
            <p className="font-semibold">{s.route.destination.name}</p>
            <p className="text-xs text-ink-500">{s.route.droppingPoints[0]}</p>
          </div>
        </div>
        <p className="mt-3 text-sm text-ink-500">{dateLong(s.departureAt)} · {s.bus.operatorName} · {busTypeLabel(s.bus)} · {s.bus.registrationNo}</p>
      </div>

      {/* perforation */}
      <div className="relative flex items-center">
        <span className="absolute -left-3 h-6 w-6 rounded-full bg-slate-50 ring-1 ring-slate-200" />
        <div className="mx-6 w-full border-t-2 border-dashed border-slate-200" />
        <span className="absolute -right-3 h-6 w-6 rounded-full bg-slate-50 ring-1 ring-slate-200" />
      </div>

      <div className="grid gap-6 p-6 sm:grid-cols-[1fr_auto]">
        <div>
          <p className="label">Passengers</p>
          <ul className="divide-y divide-slate-100">
            {b.passengers.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                <span><span className="font-semibold">{p.name}</span> <span className="text-ink-500">· {p.age} · {titleCase(p.gender)}</span></span>
                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700">{p.seatNumber}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4 sm:w-52">
          <p className="label">Total fare</p>
          <p className="text-2xl font-extrabold">{inr(b.fare.totalAmount)}</p>
          <p className="mt-1 text-xs text-ink-500">incl. {inr(b.fare.taxAmount)} GST & {inr(b.fare.feeAmount)} fees</p>
        </div>
      </div>
    </div>
  );
}
