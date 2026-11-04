import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Bus, Menu, Ticket, X } from 'lucide-react';

export function Logo({ light }) {
  return (
    <Link to="/" className="flex items-center gap-2">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white shadow-md shadow-brand-600/30">
        <Bus className="h-5 w-5" />
      </span>
      <span className={`text-xl font-extrabold tracking-tight ${light ? 'text-white' : 'text-ink-900'}`}>
        Bus<span className="text-brand-600">Yatra</span>
      </span>
    </Link>
  );
}

const links = [
  { to: '/manage', label: 'Manage booking', icon: Ticket },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const linkCls = ({ isActive }) =>
    `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${isActive ? 'text-brand-600' : 'text-ink-700 hover:text-ink-900'}`;

  return (
    <header className={`sticky top-0 z-40 transition-all ${scrolled ? 'border-b border-slate-200 bg-white/90 shadow-sm backdrop-blur' : 'bg-white'}`}>
      <div className="container-page flex h-16 items-center justify-between">
        <Logo />
        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={linkCls}>
              <l.icon className="h-4 w-4" /> {l.label}
            </NavLink>
          ))}
          <NavLink to="/admin" className={linkCls}>
            Admin
          </NavLink>
        </nav>
        <button className="rounded-lg p-2 md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menu">
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-slate-200 bg-white md:hidden"
          >
            <div className="container-page flex flex-col py-3">
              {links.map((l) => (
                <NavLink key={l.to} to={l.to} className={linkCls}>
                  <l.icon className="h-4 w-4" /> {l.label}
                </NavLink>
              ))}
              <NavLink to="/admin" className={linkCls}>Admin</NavLink>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
