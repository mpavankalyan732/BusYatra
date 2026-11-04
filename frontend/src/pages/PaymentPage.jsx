import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CreditCard, FlaskConical, Loader2, RotateCcw, ShieldCheck, Smartphone, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import PageTransition from '../components/layout/PageTransition';
import Stepper from '../components/booking/Stepper';
import HoldTimer from '../components/booking/HoldTimer';
import { CardForm, UpiForm } from '../components/payment/PaymentForms';
import { Button, FullPageLoader } from '../components/ui';
import { api } from '../api';
import { useBooking } from '../context/BookingContext';
import { inr } from '../utils/format';

const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

export default function PaymentPage() {
  const navigate = useNavigate();
  const ctx = useBooking();
  const { hold } = ctx;
  const [b, setB] = useState(null);
  const [method, setMethod] = useState('CARD');
  const [phase, setPhase] = useState('idle'); // idle | processing | confirming | failed
  const [failure, setFailure] = useState(null);
  const [instruments, setInstruments] = useState(null);
  const inFlight = useRef(false); // hard guard against double submission

  useEffect(() => {
    if (!hold) return;
    api.booking(hold.bookingId, { accessToken: hold.accessToken }).then(setB).catch((e) => toast.error(e.message));
    api.testInstruments().then(setInstruments).catch(() => {});
  }, [hold]);

  if (!hold) return <Navigate to="/" replace />;
  if (!b) return <FullPageLoader />;
  if (b.status === 'CONFIRMED') return <Navigate to={`/booking/${b.bookingCode}`} replace />;

  const finish = async () => {
    setPhase('confirming');
    const confirmed = await api.confirmBooking(hold.bookingId, hold.accessToken);
    ctx.rememberTicket(confirmed.bookingCode, hold.accessToken);
    // The journey state is cleared by the success page; clearing it here would trigger this
    // page's own "no hold -> go home" redirect while it is still animating out.
    navigate(`/booking/${confirmed.bookingCode}?new=1`, { replace: true });
  };

  const pay = async (details) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setFailure(null);
    setPhase('processing');
    try {
      const intent = await api.createPayment({ bookingId: hold.bookingId, method }, hold.accessToken, uuid());
      const result = await api.verifyPayment({ paymentId: intent.id, ...details }, hold.accessToken);
      if (result.status === 'SUCCEEDED') return await finish();
      setFailure(result.failureReason || 'Payment failed');
      setPhase('failed');
    } catch (e) {
      if (e.code === 'ALREADY_PAID') {
        await finish().catch((err) => { setFailure(err.message); setPhase('failed'); });
        return;
      }
      setFailure(e.message);
      setPhase('failed');
      if (e.code === 'HOLD_EXPIRED') navigate(`/book/${b.schedule.id}/seats`);
    } finally {
      inFlight.current = false;
    }
  };

  const busy = phase === 'processing' || phase === 'confirming';

  return (
    <PageTransition className="container-page py-6">
      <div className="mb-6"><Stepper current={3} /></div>
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_320px]">
        <div className="card relative overflow-hidden p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-extrabold">Payment</h2>
            <HoldTimer until={b.lockExpiresAt} onExpire={() => { toast.error('Seat hold expired'); navigate(`/book/${b.schedule.id}/seats`); }} />
          </div>

          <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <FlaskConical className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-bold">Demo payment — no real money is charged</p>
              <p className="mt-0.5">Only test instruments are accepted. Do not enter a real card.</p>
              {instruments && (
                <div className="mt-2 grid gap-x-4 gap-y-1 font-mono text-xs sm:grid-cols-2">
                  {instruments.cards.map((c) => <span key={c.number}>{c.number.replace(/(.{4})/g, '$1 ')} → {c.outcome === 'SUCCEEDED' ? '✓' : '✗'} {c.label}</span>)}
                  {instruments.upi.map((u) => <span key={u.upiId}>{u.upiId} → {u.outcome === 'SUCCEEDED' ? '✓' : '✗'} {u.label}</span>)}
                </div>
              )}
            </div>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
            {[['CARD', 'Debit / Credit card', CreditCard], ['UPI', 'UPI', Smartphone]].map(([k, l, I]) => (
              <button key={k} disabled={busy} onClick={() => { setMethod(k); setPhase('idle'); setFailure(null); }} className="relative rounded-xl py-2.5 text-sm font-semibold">
                {method === k && <motion.span layoutId="paytab" className="absolute inset-0 rounded-xl bg-white shadow-sm" />}
                <span className="relative flex items-center justify-center gap-2"><I className="h-4 w-4" />{l}</span>
              </button>
            ))}
          </div>

          <AnimatePresence>
            {phase === 'failed' && (
              <motion.div key="failed" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
                  <XCircle className="h-6 w-6 shrink-0 text-red-500" />
                  <div className="flex-1">
                    <h3 className="font-bold text-red-800">Payment failed</h3>
                    <p className="text-sm text-red-700">{failure}</p>
                    <p className="mt-0.5 text-xs text-red-700/80">You have not been charged and your seats are still held. Check the details below and retry.</p>
                  </div>
                  <button onClick={() => setPhase('idle')} className="flex items-center gap-1 text-xs font-semibold text-red-700"><RotateCcw className="h-3.5 w-3.5" /> Dismiss</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence mode="wait">
            <motion.div key={method} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
              {method === 'CARD' ? <CardForm amount={b.fare.totalAmount} onPay={pay} busy={busy} /> : <UpiForm amount={b.fare.totalAmount} onPay={pay} busy={busy} />}
            </motion.div>
          </AnimatePresence>

          {/* Processing overlay */}
          <AnimatePresence>
            {busy && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-white/95 backdrop-blur-sm">
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.1, ease: 'linear' }}>
                  <Loader2 className="h-12 w-12 text-brand-600" />
                </motion.div>
                <p className="text-lg font-bold">{phase === 'processing' ? 'Processing payment…' : 'Confirming your booking…'}</p>
                <p className="text-sm text-ink-500">Please don't close or refresh this page</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <aside className="card h-fit p-5">
          <h3 className="font-bold">{b.schedule.route.origin.name} → {b.schedule.route.destination.name}</h3>
          <p className="text-sm text-ink-500">{b.schedule.bus.operatorName} · Seats {b.seatNumbers.join(', ')}</p>
          <div className="mt-4 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-ink-500">Base fare</span><span>{inr(b.fare.baseAmount)}</span></div>
            <div className="flex justify-between"><span className="text-ink-500">GST</span><span>{inr(b.fare.taxAmount)}</span></div>
            <div className="flex justify-between"><span className="text-ink-500">Fees</span><span>{inr(b.fare.feeAmount)}</span></div>
            <div className="flex justify-between border-t border-dashed border-slate-300 pt-2 text-base font-extrabold"><span>Total</span><span>{inr(b.fare.totalAmount)}</span></div>
          </div>
          {b.payments.some((p) => p.status === 'FAILED') && (
            <p className="mt-4 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs text-ink-500"><AlertTriangle className="h-4 w-4 shrink-0" /> A previous attempt failed. You can safely retry.</p>
          )}
          <p className="mt-4 flex items-center gap-1.5 text-xs text-ink-500"><ShieldCheck className="h-4 w-4 text-green-600" /> Card data is never stored. Only a masked reference is kept.</p>
        </aside>
      </div>
    </PageTransition>
  );
}
