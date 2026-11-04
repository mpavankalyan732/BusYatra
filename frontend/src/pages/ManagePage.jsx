import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ticket } from 'lucide-react';
import PageTransition from '../components/layout/PageTransition';
import { Button, Field } from '../components/ui';

export default function ManagePage() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  return (
    <PageTransition className="container-page max-w-md py-12">
      <div className="mb-6 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600"><Ticket className="h-7 w-7" /></div>
        <h1 className="mt-4 text-2xl font-extrabold">Manage your booking</h1>
        <p className="text-ink-500">View, download or verify your e-ticket.</p>
      </div>
      <form
        className="card space-y-4 p-6"
        onSubmit={(e) => {
          e.preventDefault();
          navigate(`/booking/${code.trim().toUpperCase()}`, { state: { email: email.trim() } });
        }}
      >
        <Field label="Booking ID"><input className="input font-mono uppercase" value={code} onChange={(e) => setCode(e.target.value)} placeholder="BUS202611030001" pattern="[Bb][Uu][Ss]\d{12}" required /></Field>
        <Field label="Email used for booking"><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
        <Button type="submit" className="w-full" size="lg">Find booking</Button>
      </form>
    </PageTransition>
  );
}
