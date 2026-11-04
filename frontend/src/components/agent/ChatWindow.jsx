import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, CheckCircle2, FlaskConical, Send, Sparkles, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../api';
import { Button } from '../ui';
import { busTypeLabel, dateShort, inr, time } from '../../utils/format';

function Typing() {
  return (
    <div className="flex gap-1 px-1 py-2">
      {[0, 1, 2].map((i) => (
        <motion.span key={i} className="h-2 w-2 rounded-full bg-slate-400" animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }} />
      ))}
    </div>
  );
}

function Alternatives({ items, onPick, disabled }) {
  return (
    <div className="mt-3 grid gap-2">
      {items.map((s, i) => (
        <button
          key={s.id}
          disabled={disabled}
          onClick={() => onPick(`select:${s.id}`, `Option ${i + 1}: ${time(s.departureAt)} ${s.bus.operatorName}`)}
          className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left text-sm transition hover:border-brand-300 hover:bg-brand-50 disabled:opacity-50"
        >
          <div>
            <p className="font-bold">{i + 1}. {time(s.departureAt)} → {time(s.arrivalAt)} <span className="font-normal text-ink-500">· {dateShort(s.departureAt)}</span></p>
            <p className="text-xs text-ink-500">{s.bus.operatorName} · {busTypeLabel(s.bus)} · {s.availableSeats} seats</p>
          </div>
          <span className={`shrink-0 text-xs font-bold ${s.estimatedNetPayable >= 0 ? 'text-ink-900' : 'text-green-700'}`}>
            {s.estimatedNetPayable >= 0 ? `+${inr(s.estimatedNetPayable)}` : `refund ${inr(-s.estimatedNetPayable)}`}
          </span>
        </button>
      ))}
    </div>
  );
}

function Quote({ q }) {
  const s = q.proposed.schedule;
  return (
    <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm">
      <p className="font-bold text-blue-900">{dateShort(s.departureAt)} · {time(s.departureAt)} → {time(s.arrivalAt)}</p>
      <p className="text-blue-900/80">{s.bus.operatorName} · Seats {q.proposed.seatNumbers.join(', ')}</p>
      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
        <div><p className="text-blue-900/60">Fare diff.</p><p className="font-bold">{q.fareDifference < 0 ? '-' : ''}{inr(Math.abs(q.fareDifference))}</p></div>
        <div><p className="text-blue-900/60">Fee</p><p className="font-bold">{inr(q.rescheduleFee)}</p></div>
        <div><p className="text-blue-900/60">{q.netPayable >= 0 ? 'You pay' : 'Refund'}</p><p className="font-bold">{inr(Math.abs(q.netPayable))}</p></div>
      </div>
    </div>
  );
}

export default function ChatWindow({ token, bookingCode }) {
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(true);
  const endRef = useRef(null);

  useEffect(() => {
    api.startAgent(token)
      .then((s) => {
        setSession(s);
        setMessages(s.messages);
      })
      .catch((e) => {
        toast.error(e.message);
        setMessages([{ role: 'agent', text: `Sorry, I couldn't start the assistant: ${e.message}` }]);
      })
      .finally(() => setBusy(false));
  }, [token]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, busy]);

  const send = async (value, display) => {
    const v = (value ?? text).trim();
    if (!v || busy || !session) return;
    setText('');
    setMessages((m) => [...m, { role: 'user', text: display || v }]);
    setBusy(true);
    try {
      const r = await api.agentMessage(token, session.sessionId, v);
      setMessages((m) => [...m, ...r.messages]);
    } catch (e) {
      setMessages((m) => [...m, { role: 'agent', text: `⚠️ ${e.message}`, error: true }]);
    } finally {
      setBusy(false);
    }
  };

  const lastAgentIdx = messages.map((m) => m.role).lastIndexOf('agent');
  const finished = messages.some((m) => m.data?.type === 'done');

  return (
    <div className="card flex h-[70vh] min-h-[480px] flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-5 py-3">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white"><Bot className="h-5 w-5" /></span>
        <div className="flex-1">
          <p className="font-bold">Rescheduling assistant</p>
          <p className="text-xs text-ink-500">Booking {bookingCode}</p>
        </div>
      </div>
      {session && (
        <div className={`flex items-start gap-2 px-5 py-2 text-xs ${session.provider.isMock ? 'bg-amber-50 text-amber-900' : 'bg-blue-50 text-blue-900'}`}>
          {session.provider.isMock ? <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" /> : <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />}
          <span><b>{session.provider.isMock ? 'Mock agent' : 'Powered by Salesforce Agentforce'}</b> — {session.provider.label}</span>
        </div>
      )}

      <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50 p-5">
        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`flex gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${m.role === 'user' ? 'bg-ink-900 text-white' : 'bg-white text-brand-600 ring-1 ring-slate-200'}`}>
                {m.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </span>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${m.role === 'user' ? 'rounded-tr-sm bg-brand-600 text-white' : `rounded-tl-sm bg-white shadow-sm ring-1 ${m.error ? 'ring-red-200' : 'ring-slate-200'}`}`}>
                <p className="whitespace-pre-line">{m.text}</p>
                {m.data?.type === 'alternatives' && <Alternatives items={m.data.items} onPick={send} disabled={busy || i !== lastAgentIdx} />}
                {m.data?.type === 'quote' && <Quote q={m.data.quote} />}
                {m.data?.type === 'done' && (
                  <Link to={`/booking/${m.data.booking.bookingCode}`} state={{ email: m.data.booking.contact.email }} className="mt-3 flex items-center gap-2 rounded-xl bg-green-50 p-3 font-semibold text-green-800">
                    <CheckCircle2 className="h-4 w-4" /> View updated ticket
                  </Link>
                )}
                {m.actions && i === lastAgentIdx && !busy && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {m.actions.map((a) => (
                      <Button key={a.value} size="sm" variant={a.variant === 'primary' ? 'primary' : 'secondary'} onClick={() => send(a.value, a.label)}>{a.label}</Button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {busy && (
          <div className="flex gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-white text-brand-600 ring-1 ring-slate-200"><Bot className="h-4 w-4" /></span>
            <div className="rounded-2xl rounded-tl-sm bg-white px-4 shadow-sm ring-1 ring-slate-200"><Typing /></div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2 border-t border-slate-200 bg-white p-3">
        <input
          className="input flex-1"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={finished ? 'Rescheduling complete' : 'e.g. "I want to travel tomorrow instead"'}
          disabled={!session || finished}
          maxLength={1000}
        />
        <Button type="submit" icon={Send} disabled={!text.trim() || busy || !session}>Send</Button>
      </form>
    </div>
  );
}
