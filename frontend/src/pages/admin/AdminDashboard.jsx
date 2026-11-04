import { motion } from 'framer-motion';
import { BusFront, CalendarRange, IndianRupee, Ticket, Users } from 'lucide-react';
import { Badge, FullPageLoader, statusTone } from '../../components/ui';
import { api } from '../../api';
import { useAsync } from '../../hooks/useAsync';
import { dateTime, inr } from '../../utils/format';
import { AdminTable } from './AdminLayout';

function Stat({ icon: Icon, label, value, i }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="card p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</p>
        <Icon className="h-5 w-5 text-brand-600" />
      </div>
      <p className="mt-2 text-2xl font-extrabold tabular-nums">{value}</p>
    </motion.div>
  );
}

function Breakdown({ title, data }) {
  const entries = Object.entries(data || {});
  const total = entries.reduce((s, [, v]) => s + v, 0) || 1;
  return (
    <div className="card p-5">
      <h3 className="mb-3 font-bold">{title}</h3>
      {entries.length === 0 && <p className="text-sm text-ink-500">No data yet</p>}
      <div className="space-y-2.5">
        {entries.map(([k, v]) => (
          <div key={k}>
            <div className="mb-1 flex justify-between text-xs font-semibold"><span>{k.replace('_', ' ')}</span><span className="tabular-nums">{v}</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <motion.div className={`h-full rounded-full ${statusTone(k) === 'green' ? 'bg-green-500' : statusTone(k) === 'red' ? 'bg-red-500' : statusTone(k) === 'amber' ? 'bg-amber-400' : 'bg-slate-400'}`} initial={{ width: 0 }} animate={{ width: `${(v / total) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { data, loading, error } = useAsync(() => api.admin.stats(), []);
  if (loading) return <FullPageLoader />;
  if (error) return <p className="text-red-600">{error.message}</p>;
  const t = data.totals;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold">Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat i={0} icon={Ticket} label="Total bookings" value={t.bookings} />
        <Stat i={1} icon={IndianRupee} label="Net revenue" value={inr(t.revenue)} />
        <Stat i={2} icon={Users} label="Passengers" value={t.passengers} />
        <Stat i={3} icon={BusFront} label="Active buses" value={t.activeBuses} />
        <Stat i={4} icon={CalendarRange} label="Upcoming trips" value={t.upcomingSchedules} />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Breakdown title="Booking status" data={{ CONFIRMED: t.confirmed, CANCELLED: t.cancelled, PENDING: t.pending }} />
        <Breakdown title="Payment status" data={data.paymentStatus} />
        <Breakdown title="Salesforce sync" data={data.salesforceSync} />
      </div>
      <div>
        <h2 className="mb-3 font-bold">Recent bookings</h2>
        <AdminTable head={['Booking', 'Route', 'Journey', 'Pax', 'Amount', 'Status', 'Payment', 'Salesforce']}>
          {data.recentBookings.map((b) => (
            <tr key={b.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-mono text-xs">{b.bookingCode}</td>
              <td className="whitespace-nowrap px-4 py-3">{b.schedule.route.origin.name} → {b.schedule.route.destination.name}</td>
              <td className="whitespace-nowrap px-4 py-3">{dateTime(b.schedule.departureAt)}</td>
              <td className="px-4 py-3">{b.passengers.length}</td>
              <td className="px-4 py-3 font-semibold">{inr(b.fare.totalAmount)}</td>
              <td className="px-4 py-3"><Badge tone={statusTone(b.status)}>{b.status}</Badge></td>
              <td className="px-4 py-3"><Badge tone={statusTone(b.paymentStatus)}>{b.paymentStatus}</Badge></td>
              <td className="px-4 py-3"><Badge tone={statusTone(b.salesforce.status)}>{b.salesforce.status}</Badge></td>
            </tr>
          ))}
        </AdminTable>
      </div>
    </div>
  );
}
