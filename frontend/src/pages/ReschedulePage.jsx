import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarClock, KeyRound, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import PageTransition from '../components/layout/PageTransition';
import ChatWindow from '../components/agent/ChatWindow';
import { Button, Field } from '../components/ui';
import { api } from '../api';

const STORE = 'by_reschedule';

/** "Reschedule My Booking": verify ownership with an email OTP, then chat with the agent. */
export default function ReschedulePage() {
  const location = useLocation();
  const saved = (() => {
    try {
      const s = JSON.parse(sessionStorage.getItem(STORE) || 'null');
      return s && s.expiresAt > Date.now() ? s : null;
    } catch {
      return null;
    }
  })();
  const [step, setStep] = useState(saved ? 'chat' : 'identify');
  const [code, setCode] = useState(saved?.bookingCode || location.state?.bookingCode || '');
  const [email, setEmail] = useState(location.state?.email || '');
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState(null);
  const [verified, setVerified] = useState(saved);
  const [busy, setBusy] = useState(false);

  const start = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.startVerification({ bookingCode: code.trim().toUpperCase(), email: email.trim() });
      setDevOtp(r.devOtp || null);
      toast.success('Verification code sent');
      setStep('otp');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.completeVerification({ bookingCode: code.trim().toUpperCase(), email: email.trim(), otp });
      const v = { token: r.token, bookingCode: r.bookingCode, expiresAt: Date.now() + r.expiresInSeconds * 1000 };
      sessionStorage.setItem(STORE, JSON.stringify(v));
      setVerified(v);
      setStep('chat');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    sessionStorage.removeItem(STORE);
    setVerified(null);
    setOtp('');
    setStep('identify');
  };

  return (
    <PageTransition className="container-page max-w-3xl py-10">
      <div className="mb-6 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600"><CalendarClock className="h-7 w-7" /></div>
        <h1 className="mt-4 text-2xl font-extrabold">Reschedule My Booking</h1>
        <p className="text-ink-500">Change your travel date with our assistant. Your booking is only changed after you confirm.</p>
      </div>

      <AnimatePresence mode="wait">
        {step === 'identify' && (
          <motion.form key="id" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} onSubmit={start} className="card mx-auto max-w-md space-y-4 p-6">
            <Field label="Booking ID"><input className="input font-mono uppercase" value={code} onChange={(e) => setCode(e.target.value)} placeholder="BUS202611030001" required /></Field>
            <Field label="Email used for booking"><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
            <Button type="submit" className="w-full" size="lg" loading={busy} icon={ShieldCheck}>Send verification code</Button>
            <p className="text-center text-xs text-ink-500">We verify that you own this booking before showing any details.</p>
          </motion.form>
        )}
        {step === 'otp' && (
          <motion.form key="otp" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} onSubmit={verify} className="card mx-auto max-w-md space-y-4 p-6">
            <p className="text-sm text-ink-500">If <b>{code.toUpperCase()}</b> belongs to <b>{email}</b>, we've emailed a 6-digit code.</p>
            {devOtp && (
              <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
                <b>Development mode:</b> SMTP isn't configured, so the code is shown here: <span className="font-mono text-base font-bold">{devOtp}</span>
              </p>
            )}
            <Field label="Verification code">
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
                <input className="input pl-9 font-mono text-lg tracking-[0.4em]" inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} placeholder="••••••" required autoFocus />
              </div>
            </Field>
            <Button type="submit" className="w-full" size="lg" loading={busy} disabled={otp.length !== 6}>Verify & continue</Button>
            <button type="button" onClick={() => setStep('identify')} className="w-full text-center text-sm font-semibold text-ink-500 hover:text-ink-900">Use a different booking</button>
          </motion.form>
        )}
        {step === 'chat' && verified && (
          <motion.div key="chat" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <ChatWindow token={verified.token} bookingCode={verified.bookingCode} />
            <button onClick={reset} className="mt-3 text-sm font-semibold text-ink-500 hover:text-ink-900">Start over with another booking</button>
          </motion.div>
        )}
      </AnimatePresence>
    </PageTransition>
  );
}
