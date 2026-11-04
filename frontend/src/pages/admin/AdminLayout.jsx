import { NavLink, Outlet } from 'react-router-dom';
import { BusFront, CalendarRange, LayoutDashboard, Route, Ticket } from 'lucide-react';

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/bookings', label: 'Bookings', icon: Ticket },
  { to: '/admin/buses', label: 'Buses & layouts', icon: BusFront },
  { to: '/admin/routes', label: 'Routes', icon: Route },
  { to: '/admin/schedules', label: 'Schedules', icon: CalendarRange },
];

export default function AdminLayout() {
  return (
    <div className="container-page grid gap-6 py-8 lg:grid-cols-[220px_1fr]">
      <aside className="lg:sticky lg:top-20 lg:h-fit">
        <p className="mb-3 px-3 text-xs font-bold uppercase tracking-wider text-ink-500">Admin</p>
        <nav className="flex gap-1 overflow-x-auto lg:flex-col">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) => `flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${isActive ? 'bg-ink-900 text-white' : 'text-ink-700 hover:bg-slate-100'}`}
            >
              <n.icon className="h-4 w-4" /> {n.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="min-w-0"><Outlet /></div>
    </div>
  );
}

export const AdminTable = ({ head, children }) => (
  <div className="card overflow-x-auto">
    <table className="w-full text-left text-sm">
      <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-ink-500">
        <tr>{head.map((h) => <th key={h} className="whitespace-nowrap px-4 py-3 font-semibold">{h}</th>)}</tr>
      </thead>
      <tbody className="divide-y divide-slate-100">{children}</tbody>
    </table>
  </div>
);
