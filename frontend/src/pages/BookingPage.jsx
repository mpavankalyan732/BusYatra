import { useEffect, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, Cloud, Download, Mail, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import PageTransition from '../components/layout/PageTransition';
import TicketView from '../components/ticket/TicketView';
import { Badge, Button, EmptyState, Field, FullPageLoader, statusTone } from '../components/ui';
import { api } from '../api';
import { ticketTokenFor, useBooking } from '../context/BookingContext';
import { dateTime } from '../utils/format';

/** Booking success page (after payment) and "manage booking" view. */
export default function BookingPage() {
  const { code } = useParams();
  const [params] = useSearchParams();
  const location = useLocation();
  const isNew = params.get('new') === '1';
  const [email, setEmail] = useState(location.state?.email || '');
  const [verifiedEmail, setVerifiedEmail] = useState(location.state?.email);
  const [b, setB] = useState(null);
  const [needsEmail, setNeedsEmail] = useState(false);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const access = { accessToken: ticketTokenFor(code), email: verifiedEmail };
  const { reset } = useBooking();

  // Booking journey finished: clear the in-progress state (seats, hold, passengers).
  useEffect(() => {
    if (isNew) reset();
  }, [isNew, reset]);

  const load = (opts = access) =>
    api.booking(code, opts)
      .then((data) => { setB(data); setNeedsEmail(false); })
      .catch((e) => (e.status === 403 ? setNeedsEmail(true) : setError(e)));

  useEffect(() => {
    load();
    // Poll briefly so email / Salesforce status update live after a new booking
    if (!isNew) return undefined;
    const t = setInterval(() => load(), 3000);
    const stop = setTimeout(() => clearInterval(t), 20000);
    return () => { clearInterval(t); clearTimeout(stop); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const download = async () => {
    setDownloading(true);
    try {
      const blob = await api.ticketPdf(code, access);
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), { href: url, download: `BusYatra-${code}.pdf` });
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setDownloading(false);
    }
  };

  if (error) return <div className="container-page py-12"><EmptyState icon={Search} title="Booking not found">{error.message}</EmptyState></div>;
  if (needsEmail)
    return (
      <PageTransition className="container-page max-w-md py-12">
        <form className="card p-6" onSubmit={(e) => { e.preventDefault(); setVerifiedEmail(email); load({ ...access, email }); }}>
          <h2 className="text-lg font-bold">Verify it's you</h2>
          <p className="mb-4 text-sm text-ink-500">Enter the email used for booking {code}.</p>
          <Field label="Email"><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
          <Button type="submit" className="mt-4 w-full">View booking</Button>
        </form>
      </PageTransition>
    );
  if (!b) return <FullPageLoader label="Loading your ticket…" />;

  const confirmationEmail = b.emails?.filter((e) => e.type !== 'CANCELLATION').at(-1);

  return (
    <PageTransition className="container-page max-w-3xl py-8">
      {isNew && b.status === 'CONFIRMED' && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 text-center">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.1 }} className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-green-100">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </motion.div>
          <h1 className="mt-4 text-2xl font-extrabold">Booking confirmed!</h1>
          <p className="text-ink-500">Have a great trip. Your e-ticket is ready.</p>
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: isNew ? 0.25 : 0 }}>
        <TicketView b={b} />
      </motion.div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button icon={Download} onClick={download} loading={downloading}>Download PDF ticket</Button>
        <Link to="/"><Button variant="ghost">Book another trip</Button></Link>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="card flex items-center gap-3 p-4 text-sm">
          <Mail className="h-5 w-5 text-ink-500" />
          <div className="flex-1">
            <p className="font-semibold">Email to {b.contact.email}</p>
            <p className="text-xs text-ink-500">{confirmationEmail?.transport?.startsWith('dev') ? 'SMTP not configured — rendered to server log' : confirmationEmail?.sentAt ? `Sent ${dateTime(confirmationEmail.sentAt)}` : 'Queued'}</p>
          </div>
          <Badge tone={statusTone(confirmationEmail?.status)}>{confirmationEmail?.status || 'PENDING'}</Badge>
        </div>
        <div className="card flex items-center gap-3 p-4 text-sm">
          <Cloud className="h-5 w-5 text-ink-500" />
          <div className="flex-1">
            <p className="font-semibold">Salesforce CRM sync</p>
            <p className="text-xs text-ink-500">{b.salesforce.status === 'NOT_CONFIGURED' ? 'Not configured in this environment' : b.salesforce.lastError ? 'Will retry automatically' : 'Customer & booking records'}</p>
          </div>
          <Badge tone={statusTone(b.salesforce.status)}>{b.salesforce.status.replace('_', ' ')}</Badge>
        </div>
      </div>

      {b.history?.length > 0 && (
        <details className="card mt-6 p-5">
          <summary className="cursor-pointer text-sm font-bold">Booking history ({b.history.length})</summary>
          <ol className="mt-4 space-y-3 border-l-2 border-slate-200 pl-4">
            {b.history.map((h) => (
              <li key={h.id} className="text-sm">
                <span className="font-semibold">{h.action.replaceAll('_', ' ').toLowerCase()}</span>
                <span className="text-ink-500"> · {dateTime(h.createdAt)} · {h.actor}</span>
                {h.details?.from && <p className="text-xs text-ink-500">From: {h.details.from}</p>}
              </li>
            ))}
          </ol>
        </details>
      )}
    </PageTransition>
  );
}
