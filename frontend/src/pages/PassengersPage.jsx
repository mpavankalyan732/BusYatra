import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Phone } from 'lucide-react';
import toast from 'react-hot-toast';
import PageTransition from '../components/layout/PageTransition';
import Stepper from '../components/booking/Stepper';
import TripSummaryCard from '../components/booking/TripSummaryCard';
import PassengerForm from '../components/booking/PassengerForm';
import HoldTimer from '../components/booking/HoldTimer';
import { Button, Field } from '../components/ui';
import { api } from '../api';
import { useBooking } from '../context/BookingContext';
import { inr } from '../utils/format';

const NAME_RE = /^[\p{L} .'-]{2,80}$/u;

function validate(seats, passengers, contact) {
  const errors = { pax: {}, contact: {} };
  let ok = true;
  seats.forEach((s) => {
    const p = passengers[s.id] || {};
    const e = {};
    if (!p.name || !NAME_RE.test(p.name.trim())) e.name = 'Enter a valid name (letters only)';
    const age = Number(p.age);
    if (!Number.isInteger(age) || age < 1 || age > 120) e.age = '1–120';
    if (!p.gender) e.gender = 'Select gender';
    if (Object.keys(e).length) { errors.pax[s.id] = e; ok = false; }
  });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contact.email || '')) { errors.contact.email = 'Enter a valid email'; ok = false; }
  if (!/^[6-9]\d{9}$/.test(contact.phone || '')) { errors.contact.phone = 'Enter a 10-digit mobile number'; ok = false; }
  return { ok, errors };
}

export default function PassengersPage() {
  const navigate = useNavigate();
  const booking = useBooking();
  const { schedule, selectedSeats, hold } = booking;
  const [passengers, setPassengers] = useState(booking.passengers || {});
  const [contact, setContact] = useState(() => ({ email: booking.contact?.email || '', phone: booking.contact?.phone || '' }));
  const [errors, setErrors] = useState({ pax: {}, contact: {} });
  const [saving, setSaving] = useState(false);

  // keep drafts on refresh / back
  useEffect(() => {
    booking.update({ passengers, contact });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passengers, contact]);

  if (!hold || !selectedSeats.length) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    const v = validate(selectedSeats, passengers, contact);
    setErrors(v.errors);
    if (!v.ok) return toast.error('Please fix the highlighted fields');
    setSaving(true);
    try {
      const b = await api.savePassengers(
        {
          bookingId: hold.bookingId,
          contact,
          passengers: selectedSeats.map((s) => ({ seatId: s.id, name: passengers[s.id].name.trim(), age: Number(passengers[s.id].age), gender: passengers[s.id].gender })),
        },
        hold.accessToken,
      );
      booking.update({ booking: b });
      navigate('/book/summary');
    } catch (err) {
      toast.error(err.message);
      if (err.code === 'HOLD_EXPIRED') navigate(`/book/${schedule.id}/seats`);
    } finally {
      setSaving(false);
    }
  };

  const onExpire = () => {
    toast.error('Your seat hold expired. Please select seats again.');
    booking.update({ hold: null });
    navigate(`/book/${schedule.id}/seats`);
  };

  return (
    <PageTransition className="container-page py-6">
      <button onClick={() => navigate(`/book/${schedule.id}/seats`)} className="mb-4 flex items-center gap-1 text-sm font-semibold text-ink-500 hover:text-ink-900">
        <ArrowLeft className="h-4 w-4" /> Change seats
      </button>
      <div className="mb-6"><Stepper current={1} /></div>

      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_360px]" noValidate>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-extrabold">Passenger details</h2>
            <HoldTimer until={hold.lockExpiresAt} onExpire={onExpire} />
          </div>
          {selectedSeats.map((seat, i) => (
            <PassengerForm
              key={seat.id}
              index={i}
              seat={seat}
              value={passengers[seat.id] || {}}
              errors={errors.pax[seat.id]}
              onChange={(v) => setPassengers((p) => ({ ...p, [seat.id]: v }))}
            />
          ))}
          <div className="card p-5">
            <h3 className="font-bold">Contact details</h3>
            <p className="mb-4 text-sm text-ink-500">Your e-ticket and updates will be sent here.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Email" error={errors.contact.email}>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
                  <input className="input pl-9" type="email" autoComplete="email" value={contact.email} onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))} placeholder="you@example.com" />
                </div>
              </Field>
              <Field label="Mobile number" error={errors.contact.phone}>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
                  <span className="pointer-events-none absolute left-9 top-1/2 -translate-y-1/2 text-sm text-ink-500">+91</span>
                  <input className="input pl-[4.25rem]" inputMode="numeric" autoComplete="tel-national" maxLength={10} value={contact.phone} onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value.replace(/\D/g, '') }))} placeholder="9876543210" />
                </div>
              </Field>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <TripSummaryCard schedule={schedule} />
          <div className="card p-5 lg:sticky lg:top-20">
            <div className="flex justify-between text-sm">
              <span className="text-ink-500">Seats</span>
              <span className="font-semibold">{selectedSeats.map((s) => s.seatNumber).join(', ')}</span>
            </div>
            <div className="mt-2 flex justify-between text-sm">
              <span className="text-ink-500">Base fare</span>
              <span className="font-semibold">{inr(selectedSeats.reduce((s, x) => s + x.fare, 0))}</span>
            </div>
            <Button type="submit" size="lg" className="mt-5 w-full" loading={saving}>Review booking</Button>
          </div>
        </div>
      </form>
    </PageTransition>
  );
}
