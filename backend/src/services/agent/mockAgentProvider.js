/**
 * MOCK RESCHEDULING AGENT — NOT Salesforce Agentforce.
 *
 * A deterministic, rule-based stand-in used when AGENTFORCE_CONFIGURATION is not set.
 * It is labelled as a mock in every session response and in the UI. It calls exactly the
 * same backend actions (rescheduleService) that the real Agentforce Apex actions call,
 * so swapping in Agentforce changes the conversation layer only, not the business rules.
 */
import { formatInr } from '../../lib/util.js';
import { formatIstDate, formatIstTime } from '../../lib/time.js';
import { parseDate } from './dateParser.js';
import * as rs from '../reschedule/rescheduleService.js';

export const MOCK_LABEL = 'Demo assistant (mock) — rule-based, not connected to Salesforce Agentforce';

const YES = /^(y|yes|yeah|yep|sure|ok|okay|confirm|confirmed|go ahead|please do|do it)\b/i;
const NO = /^(n|no|nope|cancel|stop|don'?t|not now)\b/i;

const money = (p) => formatInr(Math.abs(p));
const msg = (text, extra = {}) => ({ role: 'agent', text, ...extra });

function bookingLine(b) {
  const s = b.schedule;
  return `${s.route.origin.name} to ${s.route.destination.name} on ${formatIstDate(s.departureAt)} at ${formatIstTime(s.departureAt)} ` +
    `with ${s.bus.operatorName} (seat${b.seatNumbers.length > 1 ? 's' : ''} ${b.seatNumbers.join(', ')})`;
}

function describeNet(q) {
  if (q.netPayable > 0) return `You'll pay ${money(q.netPayable)} (fare difference ${q.fareDifference >= 0 ? money(q.fareDifference) : `-${money(q.fareDifference)}`} + reschedule fee ${money(q.rescheduleFee)}).`;
  if (q.netPayable < 0) return `You'll receive a refund of ${money(q.netPayable)} (new fare is lower by ${money(q.fareDifference)}, minus the ${money(q.rescheduleFee)} reschedule fee).`;
  return 'There is no additional charge.';
}

export const mockAgentProvider = {
  name: 'MOCK_AGENT',
  label: MOCK_LABEL,
  isMock: true,

  async start(session) {
    const { booking, blocker } = await rs.getBookingForAgent(session.bookingId);
    const greeting = `Hi ${booking.contact.name?.split(' ')[0] || 'there'}! I found your booking ${booking.bookingCode}: ${bookingLine(booking)}.`;
    if (blocker) return { state: { stage: 'BLOCKED' }, messages: [msg(`${greeting}\n\nUnfortunately I can't reschedule it: ${blocker}`)] };
    return {
      state: { stage: 'AWAITING_DATE' },
      messages: [msg(`${greeting}\n\nWhich date would you like to travel instead? You can say things like "tomorrow", "next Friday" or "15 Nov".`, {
        actions: [{ label: 'Tomorrow', value: 'tomorrow' }, { label: 'Day after tomorrow', value: 'day after tomorrow' }, { label: 'Show policy', value: 'policy' }],
      })],
    };
  },

  async message(session, text) {
    const state = session.state || { stage: 'AWAITING_DATE' };
    const t = String(text || '').trim();

    if (/\bpolicy|rules?|fee\b/i.test(t) && !t.startsWith('select:')) {
      return { state, messages: [msg(rs.policySummary().text)] };
    }
    if (state.stage === 'BLOCKED' || state.stage === 'DONE') {
      return { state, messages: [msg(state.stage === 'DONE' ? 'Your booking has been updated. Is there anything else? You can close this chat.' : 'This booking cannot be rescheduled. Please contact support for other options.')] };
    }

    // Choosing an option
    if (state.stage === 'AWAITING_CHOICE') {
      const opts = state.options || [];
      let scheduleId = null;
      if (t.startsWith('select:')) scheduleId = t.slice(7);
      else {
        const n = t.match(/\b(\d{1,2})\b/);
        if (n && opts[Number(n[1]) - 1]) scheduleId = opts[Number(n[1]) - 1];
      }
      if (scheduleId && opts.includes(scheduleId)) {
        try {
          const q = await rs.createQuote(session.bookingId, scheduleId, { channel: 'MOCK_AGENT' });
          const s = q.proposed.schedule;
          return {
            state: { stage: 'AWAITING_CONFIRM', requestId: q.requestId },
            messages: [msg(
              `I've held seat${q.proposed.seatNumbers.length > 1 ? 's' : ''} ${q.proposed.seatNumbers.join(', ')} on ${s.bus.operatorName}, departing ${formatIstDate(s.departureAt)} at ${formatIstTime(s.departureAt)} (arrives ${formatIstTime(s.arrivalAt)}). ` +
              `This hold lasts 10 minutes.\n\n${describeNet(q)}\n\nShall I confirm this change? (yes / no)`,
              { data: { type: 'quote', quote: q }, actions: [{ label: 'Yes, confirm', value: 'yes', variant: 'primary' }, { label: 'No, keep my booking', value: 'no' }] },
            )],
          };
        } catch (err) {
          return { state, messages: [msg(`I couldn't hold seats on that bus: ${err.message}. Please pick another option or try a different date.`)] };
        }
      }
      const date = parseDate(t);
      if (!date) return { state, messages: [msg('Please choose one of the options above (e.g. "1"), or tell me a different date.')] };
      return this.searchDate(session, date);
    }

    if (state.stage === 'AWAITING_CONFIRM') {
      if (YES.test(t)) {
        try {
          const res = await rs.confirmReschedule(session.bookingId, state.requestId, { customerConfirmed: true, actor: 'MOCK_AGENT' });
          const b = res.booking;
          return {
            state: { stage: 'DONE' },
            messages: [msg(
              `Done! Booking ${b.bookingCode} is now ${bookingLine(b)}. ` +
              `${res.netPayable > 0 ? `${money(res.netPayable)} was charged (simulated).` : res.netPayable < 0 ? `A refund of ${money(res.netPayable)} has been initiated (simulated).` : ''} ` +
              'A revised e-ticket has been emailed to you.',
              { data: { type: 'done', booking: b } },
            )],
          };
        } catch (err) {
          return { state: { stage: 'AWAITING_DATE' }, messages: [msg(`I couldn't complete the change: ${err.message}. Your original booking is unchanged. Would you like to try another date?`)] };
        }
      }
      if (NO.test(t)) {
        await rs.cancelOpenQuotes(session.bookingId);
        return { state: { stage: 'AWAITING_DATE' }, messages: [msg('No problem — I released the held seats and your original booking is unchanged. Would you like to try another date?')] };
      }
      return { state, messages: [msg('Please reply "yes" to confirm the change or "no" to keep your current booking.')] };
    }

    // AWAITING_DATE
    if (NO.test(t)) return { state, messages: [msg('Okay, your booking stays as it is. Let me know if you change your mind.')] };
    const date = parseDate(t);
    if (!date) return { state, messages: [msg('Which date would you like to travel? For example "tomorrow", "next Monday" or "20 Nov".')] };
    return this.searchDate(session, date);
  },

  async searchDate(session, date) {
    try {
      const alt = await rs.findAlternatives(session.bookingId, date);
      if (!alt.items.length) {
        return { state: { stage: 'AWAITING_DATE' }, messages: [msg(`I checked ${formatIstDate(`${date}T12:00:00+05:30`)} and there are no buses on this route with ${alt.seatCount} free seat(s). Would you like to try another date?`)] };
      }
      const items = alt.items.slice(0, 6);
      // The options themselves are rendered as cards from `data`; the text stays short.
      return {
        state: { stage: 'AWAITING_CHOICE', date, options: items.map((s) => s.id) },
        messages: [msg(`I found ${items.length} bus${items.length > 1 ? 'es' : ''} with enough free seats on ${formatIstDate(`${date}T12:00:00+05:30`)}. Amounts include the reschedule fee; exact seat prices are confirmed in the next step. Which one would you like? (tap an option or reply with its number)`, {
          data: { type: 'alternatives', items },
        })],
      };
    } catch (err) {
      return { state: { stage: 'AWAITING_DATE' }, messages: [msg(`${err.message} Would you like to try a different date?`)] };
    }
  },

  async end() {},
};
