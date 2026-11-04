import { useState } from 'react';
import { BadgeCheck, CreditCard, Lock, Smartphone } from 'lucide-react';
import { Button, Field } from '../ui';
import { api } from '../../api';
import { inr } from '../../utils/format';

const fmtCard = (v) => v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
const fmtExpiry = (v) => {
  const d = v.replace(/\D/g, '').slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

/** Card details live only in this component's memory and are sent once to the demo processor. */
export function CardForm({ amount, onPay, busy }) {
  const [card, setCard] = useState({ name: '', cardNumber: '', expiry: '', cvv: '' });
  const [err, setErr] = useState({});
  const set = (k, f = (x) => x) => (e) => setCard((c) => ({ ...c, [k]: f(e.target.value) }));

  const submit = (e) => {
    e.preventDefault();
    const n = card.cardNumber.replace(/\s/g, '');
    const [mm, yy] = card.expiry.split('/').map(Number);
    const errors = {};
    if (card.name.trim().length < 2) errors.name = 'Enter the cardholder name';
    if (n.length !== 16) errors.cardNumber = 'Enter a 16-digit card number';
    if (!mm || mm > 12 || !yy || new Date(2000 + yy, mm, 1) <= new Date()) errors.expiry = 'Invalid or past expiry';
    if (!/^\d{3}$/.test(card.cvv)) errors.cvv = '3 digits';
    setErr(errors);
    if (Object.keys(errors).length) return;
    onPay({ card: { ...card, cardNumber: n } }).then(() => setCard((c) => ({ ...c, cvv: '' })));
  };

  return (
    <form onSubmit={submit} className="space-y-4" autoComplete="off">
      <Field label="Cardholder name" error={err.name}>
        <input className="input" value={card.name} onChange={set('name')} placeholder="Name on card" />
      </Field>
      <Field label="Card number" error={err.cardNumber}>
        <div className="relative">
          <CreditCard className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
          <input className="input pl-9 font-mono tracking-wider" inputMode="numeric" value={card.cardNumber} onChange={set('cardNumber', fmtCard)} placeholder="4111 1111 1111 1111" />
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Expiry" error={err.expiry}>
          <input className="input font-mono" inputMode="numeric" value={card.expiry} onChange={set('expiry', fmtExpiry)} placeholder="MM/YY" />
        </Field>
        <Field label="CVV" error={err.cvv}>
          <input className="input font-mono" type="password" inputMode="numeric" maxLength={3} value={card.cvv} onChange={set('cvv', (v) => v.replace(/\D/g, '').slice(0, 3))} placeholder="•••" />
        </Field>
      </div>
      <Button type="submit" size="lg" className="w-full" loading={busy} icon={Lock}>Pay {inr(amount)}</Button>
    </form>
  );
}

export function UpiForm({ amount, onPay, busy }) {
  const [upiId, setUpiId] = useState('');
  const [verified, setVerified] = useState(null);
  const [checking, setChecking] = useState(false);

  const verify = async () => {
    setChecking(true);
    try {
      setVerified(await api.verifyUpi(upiId));
    } catch (e) {
      setVerified({ valid: false, error: e.message });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="space-y-4">
      <Field label="UPI ID" error={verified && !verified.valid ? 'Not a demo UPI ID. Use one of the test IDs listed.' : null}>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Smartphone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
            <input className="input pl-9" value={upiId} onChange={(e) => { setUpiId(e.target.value.trim()); setVerified(null); }} placeholder="success@demoupi" />
          </div>
          <Button variant="secondary" onClick={verify} loading={checking} disabled={upiId.length < 3}>Verify</Button>
        </div>
      </Field>
      {verified?.valid && (
        <p className="flex items-center gap-2 rounded-xl bg-green-50 px-3 py-2 text-sm font-semibold text-green-700">
          <BadgeCheck className="h-4 w-4" /> Verified: {verified.name}
        </p>
      )}
      <Button size="lg" className="w-full" loading={busy} disabled={!verified?.valid} icon={Lock} onClick={() => onPay({ upi: { upiId } })}>
        Pay {inr(amount)} via UPI
      </Button>
      <p className="text-center text-xs text-ink-500">In a real app you'd approve a collect request in your UPI app. Here it's simulated.</p>
    </div>
  );
}
