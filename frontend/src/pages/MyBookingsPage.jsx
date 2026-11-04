import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Ticket } from 'lucide-react';
import PageTransition from '../components/layout/PageTransition';
import { Badge, Button, EmptyState, FullPageLoader, statusTone } from '../components/ui';
import { api } from '../api';
import { useAsync } from '../hooks/useAsync';
import { dateLong, inr, time } from '../utils/format';

export default function MyBookingsPage() {
  const { data, loading, error } = useAsync(() => api.myBookings(), []);
  if (loading) return <FullPageLoader />;
  return (
    <PageTransition className="container-page max-w-3xl py-10">
      <h1 className="mb-6 text-2xl font-extrabold">My trips</h1>
      {error && <EmptyState title="Couldn't load trips">{error.message}</EmptyState>}
      {data?.length === 0 && (
        <EmptyState icon={Ticket} title="No trips yet" action={<Link to="/"><Button>Search buses</Button></Link>}>
          Bookings made while logged in appear here.
        </EmptyState>
      )}
      <div className="space-y-3">
        {data?.map((b, i) => (
          <motion.div key={b.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
            <Link to={`/booking/${b.bookingCode}`} className="card flex items-center gap-4 p-5 transition hover:shadow-md">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-bold">{b.schedule.route.origin.name} → {b.schedule.route.destination.name}</p>
                  <Badge tone={statusTone(b.status)}>{b.status}</Badge>
                </div>
                <p className="text-sm text-ink-500">{dateLong(b.schedule.departureAt)} · {time(b.schedule.departureAt)} · {b.schedule.bus.operatorName} · Seats {b.seatNumbers.join(', ')}</p>
                <p className="mt-1 font-mono text-xs text-ink-500">{b.bookingCode}</p>
              </div>
              <span className="font-bold">{inr(b.fare.totalAmount)}</span>
              <ArrowRight className="h-5 w-5 text-ink-500" />
            </Link>
          </motion.div>
        ))}
      </div>
    </PageTransition>
  );
}
