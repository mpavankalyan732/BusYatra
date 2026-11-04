import { useState } from 'react';
import { LayoutGrid, Pencil, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { Badge, Button, Field, Modal, Spinner } from '../../components/ui';
import SeatLayout from '../../components/seats/SeatLayout';
import { api } from '../../api';
import { useAsync } from '../../hooks/useAsync';
import { busTypeLabel, dateTime, duration, inr, istDate } from '../../utils/format';
import { AdminTable } from './AdminLayout';

const useSubmit = (onDone) => {
  const [busy, setBusy] = useState(false);
  const run = async (fn, msg) => {
    setBusy(true);
    try {
      const r = await fn();
      toast.success(typeof msg === 'function' ? msg(r) : msg);
      onDone?.();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  return [busy, run];
};
const csv = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);

// ============================================================ Buses
export function AdminBuses() {
  const buses = useAsync(() => api.admin.buses(), []);
  const layouts = useAsync(() => api.admin.layouts(), []);
  const [editing, setEditing] = useState(null); // {} for new, bus for edit
  const [layoutFor, setLayoutFor] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, run] = useSubmit(() => { setEditing(null); setLayoutFor(null); buses.reload(); });

  const save = (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const body = {
      operatorName: f.get('operatorName'),
      registrationNo: f.get('registrationNo'),
      acType: f.get('acType'),
      amenities: csv(f.get('amenities') || ''),
      rating: Number(f.get('rating') || 4.2),
    };
    if (editing.id) return run(() => api.admin.updateBus(editing.id, { ...body, isActive: f.get('isActive') === 'on' }), 'Bus updated');
    return run(() => api.admin.createBus({ ...body, serviceCode: f.get('serviceCode'), layoutTemplate: f.get('layoutTemplate') }), 'Bus created with seat layout');
  };

  const showPreview = (l) => setPreview({ template: l.label, seats: l.seats });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Buses & seat layouts</h1>
        <Button icon={Plus} onClick={() => setEditing({})}>Add bus</Button>
      </div>
      {layouts.data && (
        <div className="flex flex-wrap gap-2">
          {layouts.data.map((l) => (
            <button key={l.key} onClick={() => showPreview(l)} className="chip border-slate-200 bg-white text-ink-700 hover:border-slate-300">
              <LayoutGrid className="h-3.5 w-3.5" /> {l.label}
            </button>
          ))}
        </div>
      )}
      {buses.loading && !buses.data ? <Spinner /> : (
        <AdminTable head={['Service', 'Operator', 'Registration', 'Type', 'Layout', 'Seats', 'Trips', 'Status', '']}>
          {buses.data.map((b) => (
            <tr key={b.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-mono text-xs">{b.serviceCode}</td>
              <td className="px-4 py-3 font-semibold">{b.operatorName}</td>
              <td className="px-4 py-3">{b.registrationNo}</td>
              <td className="whitespace-nowrap px-4 py-3">{busTypeLabel(b)}</td>
              <td className="px-4 py-3 text-xs">{b.layoutTemplate}</td>
              <td className="px-4 py-3">{b.totalSeats}</td>
              <td className="px-4 py-3">{b.scheduleCount}</td>
              <td className="px-4 py-3"><Badge tone={b.isActive ? 'green' : 'slate'}>{b.isActive ? 'Active' : 'Inactive'}</Badge></td>
              <td className="whitespace-nowrap px-4 py-3">
                <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditing(b)}>Edit</Button>
                <Button size="sm" variant="ghost" icon={LayoutGrid} onClick={() => setLayoutFor(b)}>Layout</Button>
              </td>
            </tr>
          ))}
        </AdminTable>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? `Edit ${editing.serviceCode}` : 'Add bus'}>
        {editing && (
          <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
            <Field label="Operator" className="sm:col-span-2"><input name="operatorName" className="input" defaultValue={editing.operatorName} required /></Field>
            <Field label="Registration no."><input name="registrationNo" className="input uppercase" defaultValue={editing.registrationNo} required /></Field>
            {!editing.id && <Field label="Service code"><input name="serviceCode" className="input uppercase" required placeholder="BY9001" /></Field>}
            <Field label="A/C"><select name="acType" className="input" defaultValue={editing.acType || 'AC'}><option value="AC">A/C</option><option value="NON_AC">Non A/C</option></select></Field>
            {!editing.id && (
              <Field label="Seat layout">
                <select name="layoutTemplate" className="input">{layouts.data?.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}</select>
              </Field>
            )}
            <Field label="Rating"><input name="rating" type="number" step="0.1" min="0" max="5" className="input" defaultValue={editing.rating ?? 4.2} /></Field>
            <Field label="Amenities (comma separated)" className="sm:col-span-2"><input name="amenities" className="input" defaultValue={editing.amenities?.join(', ')} placeholder="WiFi, Charging Point, Water Bottle" /></Field>
            {editing.id && <label className="flex items-center gap-2 text-sm"><input name="isActive" type="checkbox" defaultChecked={editing.isActive} className="h-4 w-4 accent-brand-600" /> Active</label>}
            <Button type="submit" loading={busy} className="sm:col-span-2">Save</Button>
          </form>
        )}
      </Modal>

      <Modal open={!!layoutFor} onClose={() => setLayoutFor(null)} title={`Seat layout · ${layoutFor?.serviceCode}`}>
        {layoutFor && (
          <div className="space-y-3">
            <p className="text-sm text-ink-500">Current: <b>{layoutFor.layoutTemplate}</b>. Layouts can only be changed while no seats are held or booked on this bus.</p>
            {layouts.data?.filter((l) => l.key !== layoutFor.layoutTemplate).map((l) => (
              <Button key={l.key} variant="secondary" className="w-full" loading={busy} onClick={() => run(() => api.admin.changeLayout(layoutFor.id, l.key), 'Layout changed')}>
                Switch to {l.label}
              </Button>
            ))}
          </div>
        )}
      </Modal>

      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview?.template} wide>
        {preview && <SeatLayout seats={preview.seats} readOnly />}
      </Modal>
    </div>
  );
}

// ============================================================ Routes
export function AdminRoutes() {
  const routes = useAsync(() => api.admin.routes(), []);
  const cities = useAsync(() => api.cities(), []);
  const [editing, setEditing] = useState(null);
  const [busy, run] = useSubmit(() => { setEditing(null); routes.reload(); });

  const save = (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const body = {
      distanceKm: Number(f.get('distanceKm')),
      durationMinutes: Number(f.get('durationMinutes')),
      boardingPoints: csv(f.get('boardingPoints')),
      droppingPoints: csv(f.get('droppingPoints')),
    };
    if (editing.id) return run(() => api.admin.updateRoute(editing.id, { ...body, isActive: f.get('isActive') === 'on' }), 'Route updated');
    return run(() => api.admin.createRoute({ ...body, originId: Number(f.get('originId')), destinationId: Number(f.get('destinationId')) }), 'Route created');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Routes</h1>
        <Button icon={Plus} onClick={() => setEditing({})}>Add route</Button>
      </div>
      {routes.loading && !routes.data ? <Spinner /> : (
        <AdminTable head={['Route', 'Distance', 'Duration', 'Boarding', 'Dropping', 'Trips', 'Status', '']}>
          {routes.data.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50">
              <td className="whitespace-nowrap px-4 py-3 font-semibold">{r.origin.name} → {r.destination.name}</td>
              <td className="px-4 py-3">{r.distanceKm} km</td>
              <td className="px-4 py-3">{duration(r.durationMinutes)}</td>
              <td className="px-4 py-3 text-xs">{r.boardingPoints.join(', ')}</td>
              <td className="px-4 py-3 text-xs">{r.droppingPoints.join(', ')}</td>
              <td className="px-4 py-3">{r.scheduleCount}</td>
              <td className="px-4 py-3"><Badge tone={r.isActive ? 'green' : 'slate'}>{r.isActive ? 'Active' : 'Inactive'}</Badge></td>
              <td className="px-4 py-3"><Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditing(r)}>Edit</Button></td>
            </tr>
          ))}
        </AdminTable>
      )}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? `${editing.origin.name} → ${editing.destination.name}` : 'Add route'}>
        {editing && (
          <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
            {!editing.id && (
              <>
                <Field label="Origin"><select name="originId" className="input">{cities.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
                <Field label="Destination"><select name="destinationId" className="input">{cities.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
              </>
            )}
            <Field label="Distance (km)"><input name="distanceKm" type="number" min="1" className="input" defaultValue={editing.distanceKm} required /></Field>
            <Field label="Duration (minutes)"><input name="durationMinutes" type="number" min="15" className="input" defaultValue={editing.durationMinutes} required /></Field>
            <Field label="Boarding points (comma separated)" className="sm:col-span-2"><input name="boardingPoints" className="input" defaultValue={editing.boardingPoints?.join(', ')} required /></Field>
            <Field label="Dropping points (comma separated)" className="sm:col-span-2"><input name="droppingPoints" className="input" defaultValue={editing.droppingPoints?.join(', ')} required /></Field>
            {editing.id && <label className="flex items-center gap-2 text-sm"><input name="isActive" type="checkbox" defaultChecked={editing.isActive} className="h-4 w-4 accent-brand-600" /> Active</label>}
            <Button type="submit" loading={busy} className="sm:col-span-2">Save</Button>
          </form>
        )}
      </Modal>
    </div>
  );
}

// ============================================================ Schedules
export function AdminSchedules() {
  const [routeId, setRouteId] = useState('');
  const [date, setDate] = useState(istDate(1));
  const routes = useAsync(() => api.admin.routes(), []);
  const buses = useAsync(() => api.admin.buses(), []);
  const schedules = useAsync(() => api.admin.schedules({ routeId: routeId || undefined, date }), [routeId, date]);
  const [creating, setCreating] = useState(false);
  const [recurring, setRecurring] = useState(true);
  const [busy, run] = useSubmit(() => { setCreating(false); schedules.reload(); });

  const save = (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    run(
      () => api.admin.createSchedule({
        busId: f.get('busId'),
        routeId: f.get('routeId'),
        departureTime: f.get('departureTime'),
        baseFare: Number(f.get('baseFare')),
        recurring,
        ...(recurring ? { days: Number(f.get('days') || 30) } : { date: f.get('date') }),
      }),
      (r) => `${r.created} trip(s) created`,
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Schedules</h1>
        <Button icon={Plus} onClick={() => setCreating(true)}>Create schedule</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <select className="input w-auto" value={routeId} onChange={(e) => setRouteId(e.target.value)}>
          <option value="">All routes</option>
          {routes.data?.map((r) => <option key={r.id} value={r.id}>{r.origin.name} → {r.destination.name}</option>)}
        </select>
        <input type="date" className="input w-auto" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      {schedules.loading && !schedules.data ? <Spinner /> : (
        <AdminTable head={['Departure', 'Route', 'Bus', 'Base fare', 'Occupied', 'Status', '']}>
          {schedules.data.items.map((s) => (
            <tr key={s.id} className="hover:bg-slate-50">
              <td className="whitespace-nowrap px-4 py-3 font-semibold">{dateTime(s.departureAt)}</td>
              <td className="whitespace-nowrap px-4 py-3">{s.route.origin.name} → {s.route.destination.name}</td>
              <td className="px-4 py-3">{s.bus.operatorName} <span className="text-xs text-ink-500">{s.bus.serviceCode}</span></td>
              <td className="px-4 py-3">{inr(s.baseFare)}</td>
              <td className="px-4 py-3">{s.occupiedSeats}</td>
              <td className="px-4 py-3"><Badge tone={s.status === 'SCHEDULED' ? 'green' : 'red'}>{s.status}</Badge></td>
              <td className="px-4 py-3">
                {s.status === 'SCHEDULED' && <Button size="sm" variant="danger" loading={busy} onClick={() => window.confirm('Cancel this trip?') && run(() => api.admin.cancelSchedule(s.id), 'Trip cancelled')}>Cancel</Button>}
              </td>
            </tr>
          ))}
          {schedules.data.items.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-ink-500">No trips on this date</td></tr>}
        </AdminTable>
      )}
      <Modal open={creating} onClose={() => setCreating(false)} title="Create schedule">
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <Field label="Route" className="sm:col-span-2"><select name="routeId" className="input" required>{routes.data?.map((r) => <option key={r.id} value={r.id}>{r.origin.name} → {r.destination.name}</option>)}</select></Field>
          <Field label="Bus" className="sm:col-span-2"><select name="busId" className="input" required>{buses.data?.map((b) => <option key={b.id} value={b.id}>{b.serviceCode} · {b.operatorName} · {busTypeLabel(b)}</option>)}</select></Field>
          <Field label="Departure time (IST)"><input name="departureTime" type="time" className="input" required /></Field>
          <Field label="Base fare (₹)"><input name="baseFare" type="number" min="1" className="input" required /></Field>
          <div className="sm:col-span-2 flex gap-2">
            {[[true, 'Daily (recurring)'], [false, 'One-off trip']].map(([v, l]) => (
              <button type="button" key={l} onClick={() => setRecurring(v)} className={`chip ${recurring === v ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200'}`}>{l}</button>
            ))}
          </div>
          {recurring ? (
            <Field label="Generate for next N days"><input name="days" type="number" min="1" max="90" defaultValue={30} className="input" /></Field>
          ) : (
            <Field label="Date"><input name="date" type="date" min={istDate(0)} className="input" required /></Field>
          )}
          <Button type="submit" loading={busy} className="sm:col-span-2">Create</Button>
        </form>
      </Modal>
    </div>
  );
}
