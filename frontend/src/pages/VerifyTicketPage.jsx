import { useParams } from 'react-router-dom';
import { BadgeCheck, ShieldX } from 'lucide-react';
import PageTransition from '../components/layout/PageTransition';
import { EmptyState, FullPageLoader } from '../components/ui';
import { api } from '../api';
import { useAsync } from '../hooks/useAsync';
import { dateLong, time } from '../utils/format';

/** Target of the QR code on the ticket — shows minimal, non-sensitive info. */
export default function VerifyTicketPage() {
  const { token } = useParams();
  const { data, error, loading } = useAsync(() => api.verifyTicket(token), [token]);
  if (loading) return <FullPageLoader label="Verifying ticket…" />;
  if (error) return <div className="container-page max-w-md py-12"><EmptyState icon={ShieldX} title="Invalid ticket">This QR code is not valid or the ticket was changed/rescheduled.</EmptyState></div>;
  return (
    <PageTransition className="container-page max-w-md py-12">
      <div className={`card p-6 text-center ${data.valid ? 'ring-2 ring-green-500' : 'ring-2 ring-red-400'}`}>
        {data.valid ? <BadgeCheck className="mx-auto h-14 w-14 text-green-600" /> : <ShieldX className="mx-auto h-14 w-14 text-red-500" />}
        <h1 className="mt-3 text-xl font-extrabold">{data.valid ? 'Valid ticket' : `Ticket ${data.status.toLowerCase()}`}</h1>
        <p className="font-mono text-sm text-ink-500">{data.bookingCode}</p>
        <div className="mt-5 space-y-1 text-sm">
          <p className="font-bold">{data.route}</p>
          <p>{dateLong(data.departureAt)} · {time(data.departureAt)}</p>
          <p className="text-ink-500">{data.bus}</p>
          <p className="pt-2">Seats: {data.passengers.map((p) => `${p.seatNumber} (${p.initials})`).join(', ')}</p>
        </div>
        <p className="mt-5 text-xs text-ink-500">Demo application — not valid for travel.</p>
      </div>
    </PageTransition>
  );
}
