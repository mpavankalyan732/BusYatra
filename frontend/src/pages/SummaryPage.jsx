import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Pencil, ShieldCheck, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import PageTransition from '../components/layout/PageTransition';
import Stepper from '../components/booking/Stepper';
import HoldTimer from '../components/booking/HoldTimer';
import { Button, FullPageLoader } from '../components/ui';
import { api } from '../api';
import { useBooking } from '../context/BookingContext';
import { busTypeLabel, dateLong, duration, inr, time, titleCase } from '../utils/format';

const Row = ({ label, children, bold }) => (
  <div className={`flex justify-between gap-4 py-1.5 text-sm ${bold ? 'text-base font-extrabold' : ''}`}>
    <span className={bold ? '' : 'text-ink-500'}>{label}</span>
    <span className={bold ? '' : 'font-semibold text-right'}>{children}</span>
  </div>
);

export default function SummaryPage() {
  const navigate = useNavigate();
  const ctx = useBooking();
  const [b, setB] = useState(null);

  useEffect(() => {
    if (!ctx.hold) return;
    // Always re-read from the server: the summary must reflect what will actually be charged.
    api.booking(ctx.hold.bookingId, { accessToken: ctx.hold.accessToken })
      .then((data) => {
        if (data.status !== 'PENDING') {
          toast.error(`This booking is ${data.status.toLowerCase()}`);
          return navigate(data.bookingCode ? `/booking/${data.bookingCode}` : '/');
        }
        setB(data);
      })
      .catch((e) => toast.error(e.message));
  }, [ctx.hold, navigate]);

  if (!ctx.hold) return <Navigate to="/" replace />;
  if (!b) return <FullPageLoader label="Preparing your summary…" />;
  const s = b.schedule;

  return (
    <PageTransition className="container-page py-6">
      <div className="mb-6"><Stepper current={2} /></div>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-extrabold">Review your booking</h2>
            <HoldTimer until={b.lockExpiresAt} onExpire={() => { toast.error('Seat hold expired'); navigate(`/book/${s.id}/seats`); }} />
          </div>

          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{dateLong(s.departureAt)}</p>
                <h3 className="mt-1 text-lg font-bold">{s.route.origin.name} → {s.route.destination.name}</h3>
                <p className="text-sm text-ink-500">{s.bus.operatorName} · {busTypeLabel(s.bus)} · {s.bus.registrationNo}</p>
              </div>
              <Button variant="ghost" size="sm" icon={Pencil} onClick={() => navigate(`/book/${s.id}/seats`)}>Edit</Button>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 rounded-xl bg-slate-50 p-4 text-center text-sm">
              <div><p className="text-lg font-bold">{time(s.departureAt)}</p><p className="text-xs text-ink-500">{s.route.boardingPoints[0]}</p></div>
              <div className="self-center text-xs font-semibold text-ink-500">{duration(s.durationMinutes)}</div>
              <div><p className="text-lg font-bold">{time(s.arrivalAt)}</p><p className="text-xs text-ink-500">{s.route.droppingPoints[0]}</p></div>
            </div>
          </motion.section>

          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }} className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-bold"><Users className="h-4 w-4" /> {b.passengers.length} passenger{b.passengers.length > 1 ? 's' : ''}</h3>
              <Button variant="ghost" size="sm" icon={Pencil} onClick={() => navigate('/book/passengers')}>Edit</Button>
            </div>
            <div className="divide-y divide-slate-100">
              {b.passengers.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span><span className="font-semibold">{p.name}</span> <span className="text-ink-500">· {p.age} · {titleCase(p.gender)}</span></span>
                  <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700">Seat {p.seatNumber}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 border-t border-slate-100 pt-3 text-sm text-ink-500">Ticket will be sent to <span className="font-semibold text-ink-900">{b.contact.email}</span> · +91 {b.contact.phone}</p>
          </motion.section>
        </div>

        <motion.aside initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card h-fit p-5 lg:sticky lg:top-20">
          <h3 className="mb-2 font-bold">Fare breakdown</h3>
          <Row label={`Ticket price (${b.seatCount} × seat)`}>{inr(b.fare.baseAmount)}</Row>
          <Row label="GST (5%)">{inr(b.fare.taxAmount)}</Row>
          <Row label="Convenience fee">{inr(b.fare.feeAmount)}</Row>
          <div className="my-2 border-t border-dashed border-slate-300" />
          <Row label="Total payable" bold>{inr(b.fare.totalAmount)}</Row>
          <Button size="lg" className="mt-5 w-full" onClick={() => navigate('/book/payment')}>Proceed to pay {inr(b.fare.totalAmount)}</Button>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-ink-500"><ShieldCheck className="h-4 w-4 text-green-600" /> Price verified by server</p>
        </motion.aside>
      </div>
    </PageTransition>
  );
}
