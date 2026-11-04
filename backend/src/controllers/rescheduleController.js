import * as verification from '../services/reschedule/verificationService.js';
import * as rs from '../services/reschedule/rescheduleService.js';
import * as agent from '../services/agent/agentService.js';
import { verifyRescheduleToken } from '../middleware/auth.js';
import { forbidden, unauthorized } from '../lib/errors.js';

// ---------- ownership verification (OTP)
export async function startVerification(req, res) {
  res.json({ success: true, data: await verification.startVerification(req.body) });
}
export async function completeVerification(req, res) {
  res.json({ success: true, data: await verification.completeVerification(req.body) });
}

// ---------- direct REST reschedule API (used by the website & for testing)
const bookingIdOf = (req) => req.reschedule.bookingId;

export async function alternatives(req, res) {
  res.json({ success: true, data: await rs.findAlternatives(bookingIdOf(req), req.validQuery.date) });
}
export async function quote(req, res) {
  const data = await rs.createQuote(bookingIdOf(req), req.body.newScheduleId, { channel: 'WEB', preferredSeatNumbers: req.body.preferredSeatNumbers });
  res.status(201).json({ success: true, data });
}
export async function confirm(req, res) {
  const data = await rs.confirmReschedule(bookingIdOf(req), req.params.requestId, { customerConfirmed: req.body.customerConfirmed, actor: 'customer:web' });
  res.json({ success: true, data });
}
export async function context(req, res) {
  res.json({ success: true, data: { ...(await rs.getBookingForAgent(bookingIdOf(req))), agent: { name: agent.activeProvider().name, label: agent.activeProvider().label, isMock: agent.activeProvider().isMock } } });
}

// ---------- conversational agent (website -> backend -> Agentforce / mock)
export async function startAgent(req, res) {
  const data = await agent.startSession({
    bookingId: req.reschedule.bookingId,
    bookingCode: req.reschedule.bookingCode,
    verificationToken: req.headers['x-reschedule-token'],
  });
  res.status(201).json({ success: true, data });
}
export async function agentMessage(req, res) {
  res.json({ success: true, data: await agent.sendMessage({ sessionId: req.params.sessionId, bookingId: req.reschedule.bookingId, text: req.body.text }) });
}
export async function endAgent(req, res) {
  await agent.endSession({ sessionId: req.params.sessionId, bookingId: req.reschedule.bookingId });
  res.json({ success: true });
}

// ---------- Agentforce action callbacks (Salesforce Apex -> backend). Require API key + customer's verification token.
function grant(req) {
  const p = verifyRescheduleToken(req.body.verificationToken);
  if (!p) throw unauthorized('Customer verification token is missing or expired');
  if (req.body.bookingCode && req.body.bookingCode.toUpperCase() !== p.bookingCode) throw forbidden('Booking does not match the verified customer');
  return p;
}

export async function actionGetBooking(req, res) {
  const g = grant(req);
  const { booking, blocker, policy } = await rs.getBookingForAgent(g.bookingId);
  res.json({
    bookingCode: booking.bookingCode,
    status: booking.status,
    origin: booking.schedule.route.origin.name,
    destination: booking.schedule.route.destination.name,
    journeyDate: booking.schedule.journeyDate,
    departureAt: booking.schedule.departureAt,
    arrivalAt: booking.schedule.arrivalAt,
    operator: booking.schedule.bus.operatorName,
    seatNumbers: booking.seatNumbers,
    passengerCount: booking.passengers.length,
    totalAmount: booking.fare.totalAmount / 100,
    canReschedule: !blocker,
    reason: blocker,
    policy: policy.text,
  });
}

export async function actionFindAlternatives(req, res) {
  const g = grant(req);
  const alt = await rs.findAlternatives(g.bookingId, req.body.newDate);
  res.json({
    date: alt.date,
    count: alt.items.length,
    options: alt.items.slice(0, 8).map((s, i) => ({
      option: i + 1,
      scheduleId: s.id,
      operator: s.bus.operatorName,
      busType: `${s.bus.acType} ${s.bus.seatClass}`,
      departureAt: s.departureAt,
      arrivalAt: s.arrivalAt,
      availableSeats: s.availableSeats,
      estimatedNetPayable: s.estimatedNetPayable / 100,
    })),
  });
}

export async function actionQuote(req, res) {
  const g = grant(req);
  const q = await rs.createQuote(g.bookingId, req.body.newScheduleId, { channel: 'AGENTFORCE' });
  res.json({
    rescheduleRequestId: q.requestId,
    expiresAt: q.expiresAt,
    newDepartureAt: q.proposed.schedule.departureAt,
    newArrivalAt: q.proposed.schedule.arrivalAt,
    newSeatNumbers: q.proposed.seatNumbers,
    fareDifference: q.fareDifference / 100,
    rescheduleFee: q.rescheduleFee / 100,
    netPayable: q.netPayable / 100,
  });
}

export async function actionConfirm(req, res) {
  const g = grant(req);
  const r = await rs.confirmReschedule(g.bookingId, req.body.rescheduleRequestId, { customerConfirmed: req.body.customerConfirmed === true, actor: 'AGENTFORCE' });
  res.json({
    success: true,
    bookingCode: r.booking.bookingCode,
    newDepartureAt: r.booking.schedule.departureAt,
    seatNumbers: r.booking.seatNumbers,
    netPayable: r.netPayable / 100,
    message: 'Booking updated; a revised e-ticket has been emailed.',
  });
}
