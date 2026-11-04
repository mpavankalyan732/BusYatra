import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, BadgePercent, Headphones, ShieldCheck, Ticket, Timer } from 'lucide-react';
import PageTransition from '../components/layout/PageTransition';
import SearchForm from '../components/search/SearchForm';
import HeroIllustration from '../components/search/HeroIllustration';
import { istDate } from '../utils/format';

const fadeUp = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } } };

const ROUTES = [
  ['tirupati', 'bangalore', 'Tirupati', 'Bangalore', '5h 30m'],
  ['bangalore', 'chennai', 'Bangalore', 'Chennai', '6h 30m'],
  ['hyderabad', 'vijayawada', 'Hyderabad', 'Vijayawada', '5h 30m'],
  ['mumbai', 'goa', 'Mumbai', 'Goa', '12h'],
  ['bangalore', 'mysuru', 'Bangalore', 'Mysuru', '3h 15m'],
  ['delhi', 'jaipur', 'Delhi', 'Jaipur', '5h 30m'],
];

const FEATURES = [
  { icon: Timer, title: 'Live seat locking', text: 'Your seats are held for you while you check out — nobody else can grab them.' },
  { icon: ShieldCheck, title: 'Secure checkout', text: 'Server-verified payments and tamper-proof QR e-tickets.' },
  { icon: Headphones, title: '24×7 support', text: 'Manage, download or verify your ticket any time.' },
];

export default function HomePage() {
  return (
    <PageTransition>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-brand-50/70 via-white to-slate-50">
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brand-200/40 blur-3xl" />
        <div className="container-page grid items-center gap-8 pb-10 pt-10 lg:grid-cols-2 lg:pt-16">
          <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.08 } } }}>
            <motion.span variants={fadeUp} className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 shadow-sm ring-1 ring-brand-100">
              <BadgePercent className="h-4 w-4" /> Live seat availability on every departure
            </motion.span>
            <motion.h1 variants={fadeUp} className="mt-5 text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">
              Your next journey,<br />
              <span className="text-brand-600">booked in minutes.</span>
            </motion.h1>
            <motion.p variants={fadeUp} className="mt-4 max-w-md text-lg text-ink-500">
              Compare operators, pick the perfect seat on a live layout, and get your e-ticket instantly.
            </motion.p>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, delay: 0.15 }}>
            <HeroIllustration />
          </motion.div>
        </div>
        <div className="container-page relative z-10 pb-12">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.25 }}>
            <SearchForm />
          </motion.div>
        </div>
      </section>

      {/* Popular routes */}
      <section className="container-page py-14">
        <motion.div initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.3 }} variants={fadeUp} className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-extrabold">Popular routes</h2>
            <p className="text-ink-500">Tomorrow's departures, live availability</p>
          </div>
        </motion.div>
        <motion.div initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }} variants={{ show: { transition: { staggerChildren: 0.06 } } }} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ROUTES.map(([f, t, fn, tn, d]) => (
            <motion.div key={`${f}-${t}`} variants={fadeUp}>
              <Link to={`/buses?from=${f}&to=${t}&date=${istDate(1)}`} className="card group flex items-center justify-between p-5 transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md">
                <div>
                  <p className="font-bold">{fn} <span className="text-ink-500">→</span> {tn}</p>
                  <p className="text-sm text-ink-500">Approx. {d}</p>
                </div>
                <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-50 text-brand-600 transition group-hover:bg-brand-600 group-hover:text-white">
                  <ArrowRight className="h-5 w-5" />
                </span>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Features */}
      <section className="bg-white py-16">
        <div className="container-page">
          <motion.h2 initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp} className="text-center text-2xl font-extrabold">Why travellers choose BusYatra</motion.h2>
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }} variants={{ show: { transition: { staggerChildren: 0.08 } } }} className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <motion.div key={f.title} variants={fadeUp} className="rounded-2xl bg-slate-50 p-6">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-brand-600 shadow-sm">
                  <f.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 font-bold">{f.title}</h3>
                <p className="mt-1 text-sm text-ink-500">{f.text}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Manage CTA */}
      <section className="container-page py-14">
        <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp} className="grid gap-4 md:grid-cols-1">
          <Link to="/manage" className="card group flex items-center gap-4 p-6 transition hover:shadow-md">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-ink-900 text-white"><Ticket className="h-6 w-6" /></span>
            <div className="flex-1">
              <p className="font-bold">Already booked?</p>
              <p className="text-sm text-ink-500">View or download your e-ticket</p>
            </div>
            <ArrowRight className="h-5 w-5 text-ink-500 transition group-hover:translate-x-1" />
          </Link>
        </motion.div>
      </section>
    </PageTransition>
  );
}
