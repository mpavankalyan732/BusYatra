import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, RefreshCw, X } from 'lucide-react';
import toast from 'react-hot-toast';
import PageTransition from '../components/layout/PageTransition';
import Stepper from '../components/booking/Stepper';
import TripSummaryCard from '../components/booking/TripSummaryCard';
import SeatLayout, { SeatLegend } from '../components/seats/SeatLayout';
import { Button, EmptyState, FullPageLoader } from '../components/ui';
import { api } from '../api';
import { useBooking } from '../context/BookingContext';
import { inr, plural } from '../utils/format';

const MAX_SEATS = 6;

export default function SeatSelectionPage() {
  const { scheduleId } = useParams();
  const navigate = useNavigate();
  const booking = useBooking();
  const sameTrip = booking.schedule?.id === scheduleId;
  const hold = sameTrip ? booking.hold : null;

  const [map, setMap] = useState(null);
  const [schedule, setSchedule] = useState(sameTrip ? booking.schedule : null);
  const [selected, setSelected] = useState(() => (sameTrip ? booking.selectedSeats.map((s) => s.id) : []));
  const [error, setError] = useState(null);
  const [locking, setLocking] = useState(false);

  const load = useCallback(async () => {
    try {
      const m = await api.seats(scheduleId, hold?.bookingId);
      setMap(m);
      // Drop selections that someone else just took
      setSelected((sel) => {
        const keep = sel.filter((id) => ['available', 'held_by_you'].includes(m.seats.find((s) => s.id === id)?.status));
        if (keep.length < sel.length) toast.error('Some of your selected seats were just booked by someone else');
        return keep;
      });
    } catch (e) {
      setError(e);
    }
  }, [scheduleId, hold?.bookingId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000); // live refresh of availability
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!schedule) api.bus(scheduleId).then(setSchedule).catch(setError);
  }, [schedule, scheduleId]);

  // Seats held by this user's own pending booking count as selectable
  const seats = useMemo(() => map?.seats.map((s) => (s.status === 'held_by_you' ? { ...s, status: 'available' } : s)) || [], [map]);
  const chosen = seats.filter((s) => selected.includes(s.id));
  const total = chosen.reduce((sum, s) => sum + s.fare, 0);

  const toggle = (seat) =>
    setSelected((sel) => {
      if (sel.includes(seat.id)) return sel.filter((id) => id !== seat.id);
      if (sel.length >= MAX_SEATS) {
        toast.error(`You can book up to ${MAX_SEATS} seats at a time`);
        return sel;
      }
      return [...sel, seat.id];
    });

  const proceed = async () => {
    setLocking(true);
    try {
      const b = await api.lockSeats({ scheduleId, seatIds: selected, ...(hold ? { replaceBookingId: hold.bookingId } : {}) }, hold?.accessToken);
      const keptPassengers = Object.fromEntries(Object.entries(booking.passengers || {}).filter(([id]) => selected.includes(id)));
      booking.update({
        schedule: schedule || b.schedule,
        selectedSeats: chosen.map(({ id, seatNumber, fare, deck }) => ({ id, seatNumber, fare, deck })),
        hold: { bookingId: b.id, accessToken: b.accessToken, lockExpiresAt: b.lockExpiresAt },
        booking: b,
        passengers: sameTrip ? keptPassengers : {},
      });
      navigate('/book/passengers');
    } catch (e) {
      if (e.code === 'SEATS_UNAVAILABLE') {
        toast.error(`Seat ${e.details?.seatNumbers?.join(', ')} just got booked. Please pick another.`);
        setSelected((sel) => sel.filter((id) => !e.details?.seatIds?.includes(id)));
        load();
      } else toast.error(e.message);
    } finally {
      setLocking(false);
    }
  };

  if (error) return <div className="container-page py-10"><EmptyState title="Couldn't load this bus">{error.message}</EmptyState></div>;
  if (!map || !schedule) return <FullPageLoader label="Loading seat layout…" />;

  return (
    <PageTransition className="container-page py-6 pb-32 lg:pb-10">
      <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-1 text-sm font-semibold text-ink-500 hover:text-ink-900">
        <ArrowLeft className="h-4 w-4" /> Back to results
      </button>
      <div className="mb-6"><Stepper current={0} /></div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="card p-5 sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Select your seats</h2>
              <p className="text-sm text-ink-500">{map.availableCount} available · tap a seat to select</p>
            </div>
            <div className="flex items-center gap-3">
              <SeatLegend />
              <button onClick={load} className="rounded-lg p-1.5 text-ink-500 hover:bg-slate-100" title="Refresh availability"><RefreshCw className="h-4 w-4" /></button>
            </div>
          </div>
          <div className="overflow-x-auto pb-2">
            <SeatLayout seats={seats} selectedIds={selected} onToggle={toggle} />
          </div>
        </div>

        <div className="space-y-4">
          <TripSummaryCard schedule={schedule} />
          <div className="card hidden p-5 lg:block">
            <SelectionSummary chosen={chosen} total={total} onRemove={toggle} onContinue={proceed} locking={locking} />
          </div>
        </div>
      </div>

      {/* Mobile sticky footer */}
      <AnimatePresence>
        {chosen.length > 0 && (
          <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white p-4 shadow-2xl lg:hidden">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-ink-500">{plural(chosen.length, 'seat')}: {chosen.map((s) => s.seatNumber).join(', ')}</p>
                <p className="text-xl font-extrabold">{inr(total)}</p>
              </div>
              <Button onClick={proceed} loading={locking}>Continue</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageTransition>
  );
}

function SelectionSummary({ chosen, total, onRemove, onContinue, locking }) {
  return (
    <>
      <h3 className="font-bold">Selected seats</h3>
      {chosen.length === 0 ? (
        <p className="mt-2 text-sm text-ink-500">No seats selected yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          <AnimatePresence initial={false}>
            {chosen.map((s) => (
              <motion.li key={s.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="flex items-center justify-between rounded-xl bg-blue-50 px-3 py-2 text-sm">
                <span className="font-semibold text-blue-800">Seat {s.seatNumber}{s.deck === 'UPPER' ? ' · upper' : ''}{s.isWindow ? ' · window' : ''}</span>
                <span className="flex items-center gap-2">
                  {inr(s.fare)}
                  <button onClick={() => onRemove(s)} className="rounded p-0.5 text-blue-700 hover:bg-blue-100" aria-label={`Remove seat ${s.seatNumber}`}><X className="h-4 w-4" /></button>
                </span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
        <span className="text-sm text-ink-500">Base fare</span>
        <motion.span key={total} initial={{ scale: 1.15 }} animate={{ scale: 1 }} className="text-xl font-extrabold">{inr(total)}</motion.span>
      </div>
      <p className="mt-1 text-xs text-ink-500">Taxes & fees shown at review</p>
      <Button className="mt-4 w-full" size="lg" disabled={!chosen.length} loading={locking} onClick={onContinue}>
        Continue with {chosen.length ? plural(chosen.length, 'seat') : 'seats'}
      </Button>
    </>
  );
}
