/**
 * Rescheduling engine — the ONLY code allowed to change a confirmed booking's journey.
 * Both the Agentforce actions and the mock agent call these functions; the AI layer
 * never touches the database or seat inventory directly.
 *
 * Policy (configurable in env):
 *   - booking must be CONFIRMED (never cancelled/expired)
 *   - current departure must be more than RESCHEDULE_CUTOFF_HOURS away
 *   - at most MAX_RESCHEDULES changes per booking
 *   - same origin/destination, a different departure
 *   - customer pays fare difference + fee per seat; if the new fare is lower,
 *     the difference minus the fee is refunded (never below zero fee).
 */
import { prisma } from '../../lib/prisma.js';
import { config, salesforceConfigured } from '../../config/env.js';
import { badRequest, conflict, isUniqueViolation, notFound } from '../../lib/errors.js';
import { randomToken, seatSort, formatInr } from '../../lib/util.js';
import { formatIstDateTime, toIstDateString } from '../../lib/time.js';
import { computeFare } from '../pricing.js';
import { occupiedLockWhere, reclaimableLockWhere } from '../inventory.js';
import { bookingInclude, serializeBooking, serializeSchedule } from '../serializers.js';
import { findSchedulesWithAvailability } from '../busService.js';
import { enqueueEmail, kickEmailQueue } from '../email/emailService.js';
import { kickSalesforceSync } from '../salesforce/syncService.js';

const R = config.reschedule;

export const policySummary = () => ({
  cutoffHours: R.cutoffHours,
  feePerSeat: R.feePerSeat,
  maxReschedules: R.maxReschedules,
  text: `Rescheduling is allowed up to ${R.cutoffHours} hours before departure, at most ${R.maxReschedules} times per booking, ` +
    `on the same route. A fee of ${formatInr(R.feePerSeat)} per seat applies, plus any fare difference. ` +
    `If the new journey is cheaper, the difference (minus the fee) is refunded.`,
});

async function loadBooking(bookingId) {
  const b = await prisma.booking.findUnique({ where: { id: bookingId }, include: bookingInclude });
  if (!b) throw notFound('Booking not found');
  return b;
}

/** Returns null if allowed, otherwise a human-readable reason. */
export function rescheduleBlocker(b, now = new Date()) {
  if (b.status === 'CANCELLED') return 'This booking has been cancelled and cannot be rescheduled.';
  if (b.status !== 'CONFIRMED') return `Only confirmed bookings can be rescheduled (this one is ${b.status.toLowerCase()}).`;
  const hoursLeft = (new Date(b.schedule.departureAt) - now) / 3600000;
  if (hoursLeft < R.cutoffHours) return `Rescheduling closes ${R.cutoffHours} hours before departure.`;
  if (b.rescheduleCount >= R.maxReschedules) return `This booking has already been rescheduled the maximum of ${R.maxReschedules} times.`;
  return null;
}

export async function getBookingForAgent(bookingId) {
  const b = await loadBooking(bookingId);
  return { booking: serializeBooking(b), blocker: rescheduleBlocker(b), policy: policySummary() };
}

/** Alternatives on the same route for an IST date, with real seat availability. Never invented. */
export async function findAlternatives(bookingId, date) {
  const b = await loadBooking(bookingId);
  const blocker = rescheduleBlocker(b);
  if (blocker) throw conflict('RESCHEDULE_NOT_ALLOWED', blocker);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw badRequest('date must be YYYY-MM-DD');
  if (date < toIstDateString(new Date())) throw badRequest('The new date cannot be in the past');

  const route = b.schedule.route;
  const rows = await findSchedulesWithAvailability({
    originId: route.originId,
    destinationId: route.destinationId,
    date,
    notBefore: new Date(Date.now() + 60 * 60 * 1000), // at least 1h from now
  });

  const items = rows
    .filter((r) => r.schedule.id !== b.scheduleId && r.availableSeats >= b.seatCount)
    .map((r) => {
      // Estimate using base fare for every seat (exact seat premiums are applied in the quote).
      const est = computeFare(r.schedule.baseFare, Array.from({ length: b.seatCount }, () => ({ priceDelta: 0 })));
      const fareDifference = est.totalAmount - b.totalAmount;
      return {
        ...serializeSchedule(r.schedule, { availableSeats: r.availableSeats, totalSeats: r.totalSeats }),
        estimatedTotal: est.totalAmount,
        estimatedFareDifference: fareDifference,
        estimatedNetPayable: fareDifference + R.feePerSeat * b.seatCount,
      };
    });
  return { date, seatCount: b.seatCount, currentTotal: b.totalAmount, items, policy: policySummary() };
}

/** Pick seats on the new bus: same seat numbers if free, else best available of the same kind, else any. */
function pickSeats(newSeats, occupiedIds, oldSeatNumbers, count, oldKind) {
  const free = newSeats.filter((s) => !occupiedIds.has(s.id)).sort((a, b) => seatSort(a.seatNumber, b.seatNumber));
  const chosen = [];
  for (const num of oldSeatNumbers) {
    const s = free.find((x) => x.seatNumber === num && !chosen.includes(x));
    if (s) chosen.push(s);
  }
  for (const s of [...free.filter((x) => x.kind === oldKind), ...free]) {
    if (chosen.length >= count) break;
    if (!chosen.includes(s)) chosen.push(s);
  }
  return chosen.length >= count ? chosen.slice(0, count) : null;
}

/**
 * Create a quote: temporarily LOCKS seats on the new schedule (same locking rules as a
 * normal booking) and computes the exact fare difference. Nothing changes on the booking yet.
 */
export async function createQuote(bookingId, newScheduleId, { channel = 'WEB', preferredSeatNumbers } = {}) {
  const b = await loadBooking(bookingId);
  const blocker = rescheduleBlocker(b);
  if (blocker) throw conflict('RESCHEDULE_NOT_ALLOWED', blocker);
  if (newScheduleId === b.scheduleId) throw badRequest('Please choose a different bus or date');

  const ns = await prisma.busSchedule.findUnique({ where: { id: newScheduleId }, include: { bus: { include: { seats: true } }, route: { include: { origin: true, destination: true } } } });
  if (!ns || ns.status !== 'SCHEDULED' || !ns.bus.isActive) throw notFound('That bus is not available');
  if (ns.route.originId !== b.schedule.route.originId || ns.route.destinationId !== b.schedule.route.destinationId) {
    throw badRequest('Rescheduling is only allowed on the same route');
  }
  if (ns.departureAt < new Date(Date.now() + 60 * 60 * 1000)) throw badRequest('That bus departs too soon');

  // Release any earlier open quote for this booking.
  await cancelOpenQuotes(b.id);

  const now = new Date();
  const occupied = await prisma.seatLock.findMany({ where: { scheduleId: ns.id, ...occupiedLockWhere(now) }, select: { seatId: true } });
  const oldNumbers = preferredSeatNumbers?.length ? preferredSeatNumbers : b.passengers.map((p) => p.seat.seatNumber);
  const oldKind = b.passengers[0]?.seat.kind || 'SEATER';
  const seats = pickSeats(ns.bus.seats, new Set(occupied.map((o) => o.seatId)), oldNumbers, b.seatCount, oldKind);
  if (!seats) throw conflict('SEATS_UNAVAILABLE', `Not enough seats left on that bus for ${b.seatCount} passenger(s)`);

  const fare = computeFare(ns.baseFare, seats);
  const fareDifference = fare.totalAmount - b.totalAmount;
  const rescheduleFee = R.feePerSeat * b.seatCount;
  const expiresAt = new Date(now.getTime() + R.quoteMinutes * 60 * 1000);

  try {
    const request = await prisma.$transaction(async (tx) => {
      await tx.seatLock.deleteMany({ where: { scheduleId: ns.id, seatId: { in: seats.map((s) => s.id) }, ...reclaimableLockWhere(now) } });
      const reqRow = await tx.rescheduleRequest.create({
        data: {
          bookingId: b.id,
          oldScheduleId: b.scheduleId,
          newScheduleId: ns.id,
          newSeatIds: seats.map((s) => s.id),
          newBaseAmount: fare.baseAmount,
          newTaxAmount: fare.taxAmount,
          newFeeAmount: fare.feeAmount,
          newTotalAmount: fare.totalAmount,
          fareDifference,
          rescheduleFee,
          netPayable: fareDifference + rescheduleFee,
          channel,
          expiresAt,
        },
      });
      // bookingId stays NULL on these holds so they're reclaimable once the quote expires.
      await tx.seatLock.createMany({
        data: seats.map((s) => ({ scheduleId: ns.id, seatId: s.id, rescheduleRequestId: reqRow.id, status: 'HELD', expiresAt })),
      });
      await tx.bookingHistory.create({
        data: { bookingId: b.id, action: 'RESCHEDULE_QUOTED', actor: channel, details: { requestId: reqRow.id, newScheduleId: ns.id, seats: seats.map((s) => s.seatNumber), netPayable: fareDifference + rescheduleFee } },
      });
      return reqRow;
    });
    return describeQuote(request, b, ns, seats);
  } catch (err) {
    if (isUniqueViolation(err)) throw conflict('SEATS_UNAVAILABLE', 'Those seats were just taken - please try again');
    throw err;
  }
}

function describeQuote(request, b, ns, seats) {
  return {
    requestId: request.id,
    status: request.status,
    expiresAt: request.expiresAt,
    current: { scheduleId: b.scheduleId, departureAt: b.schedule.departureAt, seatNumbers: b.passengers.map((p) => p.seat.seatNumber).sort(seatSort), totalAmount: b.totalAmount },
    proposed: {
      schedule: serializeSchedule(ns),
      seatNumbers: seats.map((s) => s.seatNumber).sort(seatSort),
      totalAmount: request.newTotalAmount,
    },
    fareDifference: request.fareDifference,
    rescheduleFee: request.rescheduleFee,
    netPayable: request.netPayable, // > 0 customer pays, < 0 refund
    policy: policySummary(),
  };
}

export async function cancelOpenQuotes(bookingId) {
  const open = await prisma.rescheduleRequest.findMany({ where: { bookingId, status: 'QUOTED' }, select: { id: true } });
  if (!open.length) return;
  const ids = open.map((o) => o.id);
  await prisma.$transaction([
    prisma.seatLock.deleteMany({ where: { rescheduleRequestId: { in: ids }, status: 'HELD' } }),
    prisma.rescheduleRequest.updateMany({ where: { id: { in: ids } }, data: { status: 'CANCELLED' } }),
  ]);
}

/**
 * Apply a quoted reschedule. Requires explicit customer confirmation.
 * In ONE transaction: new holds -> BOOKED, old seats released, passengers moved,
 * fares updated, adjustment/refund recorded, history written, email queued.
 */
export async function confirmReschedule(bookingId, requestId, { customerConfirmed, actor = 'customer' }) {
  if (customerConfirmed !== true) throw badRequest('Explicit customer confirmation is required to change a booking');
  const b = await loadBooking(bookingId);
  const blocker = rescheduleBlocker(b);
  if (blocker) throw conflict('RESCHEDULE_NOT_ALLOWED', blocker);

  const request = await prisma.rescheduleRequest.findUnique({ where: { id: requestId }, include: { newSchedule: { include: { bus: { include: { seats: true } } } } } });
  if (!request || request.bookingId !== b.id) throw notFound('Reschedule quote not found');
  if (request.status === 'COMPLETED') return { alreadyCompleted: true, booking: serializeBooking(b) };
  if (request.status !== 'QUOTED') throw conflict('QUOTE_CLOSED', `This quote is ${request.status.toLowerCase()}`);
  if (request.expiresAt < new Date()) throw conflict('QUOTE_EXPIRED', 'This quote has expired - please request a new one');

  const oldSummary = `${b.schedule.route.origin.name} -> ${b.schedule.route.destination.name}, ${formatIstDateTime(b.schedule.departureAt)}, seats ${b.passengers.map((p) => p.seat.seatNumber).sort(seatSort).join(', ')}`;
  const newSeatsById = new Map(request.newSchedule.bus.seats.map((s) => [s.id, s]));
  const passengersSorted = [...b.passengers].sort((x, y) => seatSort(x.seat.seatNumber, y.seat.seatNumber));
  const newSeatIds = [...request.newSeatIds].sort((x, y) => seatSort(newSeatsById.get(x).seatNumber, newSeatsById.get(y).seatNumber));

  await prisma.$transaction(async (tx) => {
    const [row] = await tx.$queryRaw`SELECT "status"::text AS status FROM "RescheduleRequest" WHERE "id" = ${request.id} FOR UPDATE`;
    if (row?.status !== 'QUOTED') throw conflict('QUOTE_CLOSED', 'This quote was already processed');

    const converted = await tx.seatLock.updateMany({
      where: { rescheduleRequestId: request.id, status: 'HELD' },
      data: { status: 'BOOKED', expiresAt: null, bookingId: b.id },
    });
    if (converted.count !== b.seatCount) throw conflict('SEATS_LOST', 'The held seats are no longer available - please request a new quote');

    // Release old seats.
    await tx.seatLock.deleteMany({ where: { bookingId: b.id, scheduleId: b.scheduleId } });

    // Move passengers (delete + recreate with same ids, avoiding transient unique clashes).
    await tx.passenger.deleteMany({ where: { bookingId: b.id } });
    await tx.passenger.createMany({
      data: passengersSorted.map((p, i) => ({ id: p.id, bookingId: b.id, seatId: newSeatIds[i], name: p.name, age: p.age, gender: p.gender, createdAt: p.createdAt })),
    });

    await tx.booking.update({
      where: { id: b.id },
      data: {
        scheduleId: request.newScheduleId,
        baseAmount: request.newBaseAmount,
        taxAmount: request.newTaxAmount,
        feeAmount: request.newFeeAmount + request.rescheduleFee,
        totalAmount: request.newTotalAmount + request.rescheduleFee,
        rescheduleCount: { increment: 1 },
        ticketToken: randomToken(18),
        sfSyncStatus: salesforceConfigured() ? 'PENDING' : 'NOT_CONFIGURED',
        sfNextAttemptAt: new Date(),
      },
    });

    if (request.netPayable !== 0) {
      await tx.payment.create({
        data: {
          bookingId: b.id,
          kind: request.netPayable > 0 ? 'ADJUSTMENT' : 'REFUND',
          method: 'SYSTEM',
          status: 'SUCCEEDED',
          amount: Math.abs(request.netPayable),
          idempotencyKey: `reschedule-${request.id}`,
          providerRef: `demo_adj_${randomToken(8)}`,
          maskedInstrument: 'Simulated adjustment (demo)',
        },
      });
    }

    await tx.rescheduleRequest.update({ where: { id: request.id }, data: { status: 'COMPLETED', completedAt: new Date() } });
    await tx.bookingHistory.create({
      data: {
        bookingId: b.id,
        action: 'RESCHEDULED',
        actor,
        details: {
          requestId: request.id,
          from: oldSummary,
          fromScheduleId: b.scheduleId,
          toScheduleId: request.newScheduleId,
          newSeats: newSeatIds.map((id) => newSeatsById.get(id).seatNumber),
          fareDifference: request.fareDifference,
          fee: request.rescheduleFee,
          netPayable: request.netPayable,
        },
      },
    });
    await enqueueEmail(tx, { bookingId: b.id, type: 'RESCHEDULE_CONFIRMATION', toEmail: b.contactEmail, subject: `Booking rescheduled: ${b.bookingCode}` });
  });

  kickEmailQueue();
  kickSalesforceSync(b.id);
  const updated = await loadBooking(b.id);
  return { booking: serializeBooking(updated), netPayable: request.netPayable };
}
