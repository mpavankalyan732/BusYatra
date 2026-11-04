import { Link } from 'react-router-dom';
import { Logo } from './Navbar';

const cols = [
  { title: 'Travel', links: [['Search buses', '/'], ['Manage booking', '/manage']] },
  { title: 'Popular routes', links: [['Tirupati → Bangalore', '/buses?from=tirupati&to=bangalore'], ['Bangalore → Chennai', '/buses?from=bangalore&to=chennai'], ['Mumbai → Goa', '/buses?from=mumbai&to=goa'], ['Hyderabad → Vijayawada', '/buses?from=hyderabad&to=vijayawada']] },
  { title: 'Account', links: [['Admin', '/admin']] },
];

export default function Footer() {
  return (
    <footer className="mt-20 bg-ink-900 text-slate-300">
      <div className="container-page grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo light />
          <p className="mt-4 text-sm leading-relaxed text-slate-400">
            Search, compare and book intercity buses with live seat availability.
          </p>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <h4 className="mb-4 text-sm font-bold uppercase tracking-wider text-white">{c.title}</h4>
            <ul className="space-y-2.5 text-sm">
              {c.links.map(([label, to]) => (
                <li key={label}>
                  <Link to={to} className="transition hover:text-white">{label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-2 py-5 text-xs text-slate-500 sm:flex-row sm:justify-between">
          <span>© {new Date().getFullYear()} BusYatra. A demonstration project.</span>
          <span>Payments on this site are simulated. No real tickets are issued.</span>
        </div>
      </div>
    </footer>
  );
}
