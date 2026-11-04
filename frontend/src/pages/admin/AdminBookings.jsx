import { useState } from 'react';
import { RefreshCw, Search, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { Badge, Button, Modal, Spinner, statusTone } from '../../components/ui';
import { api } from '../../api';
import { useAsync } from '../../hooks/useAsync';
import { dateTime, inr, titleCase } from '../../utils/format';
import { AdminTable } from './AdminLayout';

export default function AdminBookings() {
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);
  const { data, loading, reload } = useAsync(() => api.admin.bookings({ status: status || undefined, q: query || undefined, page }), [status, query, page]);

  const act = async (fn, msg) => {
    setBusy(true);
    try {
      await fn();
      toast.success(msg);
      setDetail(null);
      reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">Bookings</h1>
      <div className="flex flex-wrap gap-2">
        <form onSubmit={(e) => { e.preventDefault(); setPage(1); setQuery(q); }} className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
          <input className="input pl-9" placeholder="Booking ID, email or name" value={q} onChange={(e) => setQ(e.target.value)} />
        </form>
        <select className="input w-auto" value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
          <option value="">All statuses</option>
          {['CONFIRMED', 'CANCELLED'].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
        </select>
      </div>
      {loading && !data ? <Spinner /> : (
        <AdminTable head={['Booking', 'Customer', 'Route', 'Journey', 'Seats', 'Amount', 'Status', 'Salesforce', '']}>
          {data.items.map((b) => (
            <tr key={b.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-mono text-xs">{b.bookingCode}</td>
              <td className="px-4 py-3"><p className="font-semibold">{b.contact.name}</p><p className="text-xs text-ink-500">{b.contact.email}</p></td>
              <td className="whitespace-nowrap px-4 py-3">{b.schedule.route.origin.name} → {b.schedule.route.destination.name}</td>
              <td className="whitespace-nowrap px-4 py-3">{dateTime(b.schedule.departureAt)}</td>
              <td className="px-4 py-3">{b.seatNumbers.join(', ')}</td>
              <td className="px-4 py-3 font-semibold">{inr(b.fare.totalAmount)}</td>
              <td className="px-4 py-3"><Badge tone={statusTone(b.status)}>{b.status}</Badge></td>
              <td className="px-4 py-3"><Badge tone={statusTone(b.salesforce.status)}>{b.salesforce.status}</Badge></td>
              <td className="px-4 py-3"><Button size="sm" variant="secondary" onClick={() => setDetail(b)}>Manage</Button></td>
            </tr>
          ))}
          {data.items.length === 0 && <tr><td colSpan={9} className="px-4 py-8 text-center text-ink-500">No bookings found</td></tr>}
        </AdminTable>
      )}
      {data?.totalPages > 1 && (
        <div className="flex items-center gap-3">
          <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Button>
          <span className="text-sm text-ink-500">Page {page} / {data.totalPages}</span>
          <Button size="sm" variant="secondary" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.bookingCode} wide>
        {detail && (
          <div className="space-y-4 text-sm">
            <p>{detail.schedule.route.origin.name} → {detail.schedule.route.destination.name} · {dateTime(detail.schedule.departureAt)} · {detail.schedule.bus.operatorName}</p>
            <div>
              <p className="label">Passengers</p>
              {detail.passengers.map((p) => <p key={p.id}>{p.seatNumber} — {p.name} ({p.age}, {titleCase(p.gender)})</p>)}
            </div>
            <div>
              <p className="label">Payments</p>
              {detail.payments.map((p) => <p key={p.id}>{p.kind} · {p.method} · {inr(p.amount)} · <Badge tone={statusTone(p.status)}>{p.status}</Badge> {p.maskedInstrument}</p>)}
            </div>
            {detail.salesforce.lastError && <p className="rounded-xl bg-red-50 p-3 text-xs text-red-700">Salesforce error: {detail.salesforce.lastError}</p>}
            <div>
              <p className="label">History</p>
              <ol className="space-y-1 border-l-2 border-slate-200 pl-3 text-xs">
                {detail.history?.map((h) => <li key={h.id}><b>{h.action}</b> · {dateTime(h.createdAt)} · {h.actor}</li>)}
              </ol>
            </div>
            <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              <Button variant="secondary" icon={RefreshCw} loading={busy} onClick={() => act(() => api.admin.resync(detail.id), 'Salesforce sync triggered')}>Retry Salesforce sync</Button>
              {detail.status === 'CONFIRMED' && (
                <Button variant="danger" icon={XCircle} loading={busy} onClick={() => window.confirm(`Cancel ${detail.bookingCode} and refund the customer?`) && act(() => api.admin.cancel(detail.id, 'Cancelled by admin'), 'Booking cancelled')}>
                  Cancel & refund
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
