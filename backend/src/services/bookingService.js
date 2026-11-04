import { prisma } from '../lib/prisma.js';
import { config, salesforceConfigured } from '../config/env.js';
import { badRequest, conflict, forbidden, gone, isUniqueViolation, notFound } from '../lib/errors.js';
import { randomToken, safeEqual, seatSort } from '../lib/util.js';
import { toIstDateString } from '../lib/time.js';
import { logger } from '../lib/logger.js';
import { computeFare } from './pricing.js';
import { occupiedLockWhere, reclaimableLockWhere } from './inventory.js';
import { bookingInclude } from './serializers.js';
import { enqueueEmail, kickEmailQueue } from './email/emailService.js';
import { kickSalesforceSync } from './salesforce/syncService.js';

const minutes = (n) => n * 60 * 1000;

// ------------------------------------------------------------------ access

/** Load a booking by internal id or booking code. */
export async function findBooking(idOrCode, include = bookingInclude) {
  const where = /^BUS\d{12}$/.test(idOrCode) ? { bookingCode: idOrCode } : { id: idOrCode };
  const booking = await prisma.booking.findUnique({ where, include });
  if (!booking) throw notFound('Booking not found');
  return booking;
}

/**
 * A caller may access a booking if they present its accessToken (they created it),
 * own it (JWT), are an admin, or — for confirmed tickets — know the contact email.
 */
export function assertAccess(booking, { accessToken, email, user } = {}) {
  if (accessToken && safeEqual(accessToken, booking.accessToken)) return;
  if (user && (user.role === 'ADMIN' || (booking.userId && booking.userId === user.id))) return;
  if (email && booking.status !== 'PENDING' && booking.contactEmail &&
      booking.contactEmail.toLowerCase() === String(email).trim().toLowerCase()) return;
  throw forbidden('You do not have access to this booking');
}

const assertOwner = (booking, accessToken) => {
  if (!accessToken || !safeEqual(accessToken, booking.accessToken)) throw forbidden('Invalid booking access token');
};

// ------------------------------------------------------------------ seat locking

/**
 * Temporarily reserve seats. Creates a PENDING booking plus one HELD SeatLock per seat.
 * Correctness under concurrency comes from the UNIQUE(scheduleId, seatId) index:
 * if two customers race for a seat, exactly one INSERT succeeds.
 */
export async function lockSeats({ scheduleId, seatIds, user, replaceBookingId, accessToken }) {
  const ids = [...new Set(seatIds)];
  if (ids.length < 1 || ids.length > config.booking.maxSeatsPerBooking) {
    throw badRequest(`Select between 1 and ${config.booking.maxSeatsPerBooking} seats`);
  }
  const schedule = await prisma.busSchedule.findUnique({ where: { id: scheduleId }, include: { bus: { include: { seats: true } } } });
  if (!schedule || schedule.status !== 'SCHEDULED' || !schedule.bus.isActive) throw notFound('This bus is no longer available');
  if (schedule.departureAt <= new Date()) throw gone('DEPARTED', 'This bus has already departed');

  const seats = schedule.bus.seats.filter((s) => ids.includes(s.id));
  if (seats.length !== ids.length) throw badRequest('One or more seats do not belong to this bus');

  // Optionally release the caller's previous hold (e.g. user went back and changed seats).
  let previous = null;
  if (replaceBookingId) {
    previous = await prisma.booking.findUnique({ where: { id: replaceBookingId }, include: { payments: true } });
    if (!previous || !safeEqual(accessToken || '', previous.accessToken) || previous.status !== 'PENDING') previous = null;
    else if (previous.payments.some((p) => p.status === 'SUCCEEDED')) {
      throw conflict('ALREADY_PAID', 'This booking is already paid; seats can no longer be changed');
    }
  }

  const now = new Date();
  const lockExpiresAt = new Date(now.getTime() + minutes(config.booking.seatLockMinutes));
  const fare = computeFare(schedule.baseFare, seats);

  try {
    const booking = await prisma.$transaction(async (tx) => {
      if (previous) {
        await tx.seatLock.deleteMany({ where: { bookingId: previous.id, status: 'HELD' } });
        await tx.booking.update({ where: { id: previous.id }, data: { status: 'EXPIRED' } });
        await tx.bookingHistory.create({ data: { bookingId: previous.id, action: 'HOLD_REPLACED', actor: 'customer' } });
      }
      // Reclaim stale holds on exactly these seats, then try to insert ours.
      await tx.seatLock.deleteMany({ where: { scheduleId, seatId: { in: ids }, ...reclaimableLockWhere(now) } });
      const created = await tx.booking.create({
        data: {
          scheduleId,
          userId: user?.id || null,
          accessToken: randomToken(),
          seatCount: seats.length,
          lockExpiresAt,
          ...fare,
          contactEmail: previous?.contactEmail,
          contactPhone: previous?.contactPhone,
          contactName: previous?.contactName,
        },
      });
      await tx.seatLock.createMany({
        data: seats.map((s) => ({ scheduleId, seatId: s.id, bookingId: created.id, status: 'HELD', expiresAt: lockExpiresAt })),
      });
      await tx.bookingHistory.create({
        data: {
          bookingId: created.id,
          action: 'SEATS_HELD',
          actor: user ? `user:${user.id}` : 'guest',
          details: { seats: seats.map((s) => s.seatNumber).sort(seatSort), expiresAt: lockExpiresAt },
        },
      });
      return created;
    });
    return prisma.booking.findUnique({ where: { id: booking.id }, include: bookingInclude });
  } catch (err) {
    if (isUniqueViolation(err)) {
      const taken = await prisma.seatLock.findMany({
        where: { scheduleId, seatId: { in: ids }, ...occupiedLockWhere() },
        include: { seat: true },
      });
      throw conflict('SEATS_UNAVAILABLE', 'Sorry, one or more selected seats were just booked by someone else', {
        seatIds: taken.map((t) => t.seatId),
        seatNumbers: taken.map((t) => t.seat.seatNumber).sort(seatSort),
      });
    }
    throw err;
  }
}

export async function releaseHold({ bookingId, accessToken }) {
  const booking = await findBooking(bookingId, { payments: true });
  assertOwner(booking, accessToken);
  if (booking.status !== 'PENDING') return;
  if (booking.payments.some((p) => p.status === 'SUCCEEDED')) throw conflict('ALREADY_PAID', 'Booking is already paid');
  await prisma.$transaction([
    prisma.seatLock.deleteMany({ where: { bookingId: booking.id, status: 'HELD' } }),
    prisma.booking.update({ where: { id: booking.id }, data: { status: 'EXPIRED' } }),
    prisma.bookingHistory.create({ data: { bookingId: booking.id, action: 'HOLD_RELEASED', actor: 'customer' } }),
  ]);
}

// ------------------------------------------------------------------ passengers

export async function savePassengers({ bookingId, accessToken, contact, passengers, user }) {
  const booking = await findBooking(bookingId);
  assertOwner(booking, accessToken);
  if (booking.status !== 'PENDING') throw conflict('NOT_PENDING', `Booking is ${booking.status.toLowerCase()}`);
  if (booking.lockExpiresAt < new Date()) throw gone('HOLD_EXPIRED', 'Your seat hold has expired. Please select seats again.');
  if (booking.payments.some((p) => p.status === 'SUCCEEDED')) throw conflict('ALREADY_PAID', 'Booking is already paid');

  const heldSeatIds = booking.locks.filter((l) => l.status === 'HELD').map((l) => l.seatId).sort();
  const givenSeatIds = passengers.map((p) => p.seatId).sort();
  if (heldSeatIds.length !== givenSeatIds.length || heldSeatIds.some((id, i) => id !== givenSeatIds[i])) {
    throw badRequest(`Exactly one passenger is required for each of your ${heldSeatIds.length} selected seat(s)`);
  }

  await prisma.$transaction([
    prisma.passenger.deleteMany({ where: { bookingId: booking.id } }),
    prisma.passenger.createMany({
      data: passengers.map((p) => ({ bookingId: booking.id, seatId: p.seatId, name: p.name.trim(), age: p.age, gender: p.gender })),
    }),
    prisma.booking.update({
      where: { id: booking.id },
      data: {
        contactEmail: contact.email.trim().toLowerCase(),
        contactPhone: contact.phone.trim(),
        contactName: passengers[0].name.trim(),
        userId: booking.userId || user?.id || null,
      },
    }),
    prisma.bookingHistory.create({ data: { bookingId: booking.id, action: 'PASSENGERS_ADDED', actor: 'customer', details: { count: passengers.length } } }),
  ]);
  return findBooking(booking.id);
}

// ------------------------------------------------------------------ confirmation

/** Atomically increments a per-day counter -> BUS202611030001 */
async function nextBookingCode(tx, now = new Date()) {
  const day = toIstDateString(now).replaceAll('-', '');
  const rows = await tx.$queryRaw`
    INSERT INTO "DailyCounter" ("day", "value") VALUES (${day}, 1)
    ON CONFLICT ("day") DO UPDATE SET "value" = "DailyCounter"."value" + 1
    RETURNING "value"`;
  return `BUS${day}${String(rows[0].value).padStart(4, '0')}`;
}

/**
 * Confirm a paid booking. Idempotent. The backend checks payment status itself —
 * the client's word that "payment succeeded" is never trusted.
 */
export async function confirmBooking({ bookingId, accessToken, actor = 'customer', skipAccessCheck = false }) {
  const booking = await findBooking(bookingId);
  if (!skipAccessCheck) assertOwner(booking, accessToken);
  if (booking.status === 'CONFIRMED') return booking;
  if (booking.status !== 'PENDING') throw conflict('NOT_PENDING', `Booking is ${booking.status.toLowerCase()}`);
  if (!booking.passengers.length) throw badRequest('Passenger details are missing');
  const payment = booking.payments.find((p) => p.kind === 'BOOKING' && p.status === 'SUCCEEDED');
  if (!payment) throw conflict('PAYMENT_REQUIRED', 'Payment has not been completed for this booking');

  try {
    await prisma.$transaction(async (tx) => {
      // Serialise concurrent confirm calls for the same booking.
      const [row] = await tx.$queryRaw`SELECT "status"::text AS status FROM "Booking" WHERE "id" = ${booking.id} FOR UPDATE`;
      if (row?.status !== 'PENDING') throw Object.assign(new Error('already processed'), { code: 'ALREADY_DONE' });

      // Convert our holds into permanent bookings. If any hold vanished we must not confirm.
      const converted = await tx.seatLock.updateMany({
        where: { bookingId: booking.id, scheduleId: booking.scheduleId, status: 'HELD' },
        data: { status: 'BOOKED', expiresAt: null },
      });
      if (converted.count !== booking.seatCount) {
        throw conflict('SEATS_LOST', 'Seat hold was lost before confirmation');
      }
      const bookingCode = await nextBookingCode(tx);
      const updated = await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: 'CONFIRMED',
          bookingCode,
          ticketToken: randomToken(18),
          confirmedAt: new Date(),
          sfSyncStatus: salesforceConfigured() ? 'PENDING' : 'NOT_CONFIGURED',
          sfNextAttemptAt: new Date(),
        },
      });
      await tx.bookingHistory.create({
        data: { bookingId: booking.id, action: 'CONFIRMED', actor, details: { bookingCode, paymentId: payment.id, amount: payment.amount } },
      });
      await enqueueEmail(tx, {
        bookingId: booking.id,
        type: 'BOOKING_CONFIRMATION',
        toEmail: updated.contactEmail,
        subject: `Your BusYatra Bus Booking is Confirmed – ${bookingCode}`,
      });
    });
  } catch (err) {
    if (err.code === 'SEATS_LOST') {
      // Extremely rare (hold reclaimed despite payment). Refund and expire.
      await prisma.$transaction([
        prisma.payment.update({ where: { id: payment.id }, data: { status: 'REFUNDED', failureReason: 'Seats unavailable - auto refund (demo)' } }),
        prisma.seatLock.deleteMany({ where: { bookingId: booking.id, status: 'HELD' } }),
        prisma.booking.update({ where: { id: booking.id }, data: { status: 'EXPIRED' } }),
        prisma.bookingHistory.create({ data: { bookingId: booking.id, action: 'AUTO_REFUNDED', actor: 'system' } }),
      ]);
      logger.warn({ bookingId: booking.id }, 'Seats lost before confirmation - payment refunded');
    } else if (err.code === 'ALREADY_DONE') {
      return findBooking(booking.id); // confirmed concurrently by another request
    }
    throw err;
  }

  kickEmailQueue();
  kickSalesforceSync(booking.id);
  return findBooking(booking.id);
}

// ------------------------------------------------------------------ cancellation (admin)

export async function cancelBooking({ bookingId, actor, reason }) {
  const booking = await findBooking(bookingId);
  if (booking.status !== 'CONFIRMED') throw conflict('NOT_CONFIRMED', 'Only confirmed bookings can be cancelled');
  const paid = booking.payments
    .filter((p) => p.status === 'SUCCEEDED')
    .reduce((sum, p) => sum + (p.kind === 'REFUND' ? -p.amount : p.amount), 0);

  await prisma.$transaction(async (tx) => {
    await tx.seatLock.deleteMany({ where: { bookingId: booking.id } });
    await tx.booking.update({
      where: { id: booking.id },
      data: { status: 'CANCELLED', cancelledAt: new Date(), sfSyncStatus: salesforceConfigured() ? 'PENDING' : 'NOT_CONFIGURED', sfNextAttemptAt: new Date() },
    });
    if (paid > 0) {
      await tx.payment.create({
        data: { bookingId: booking.id, kind: 'REFUND', method: 'SYSTEM', status: 'SUCCEEDED', amount: paid, idempotencyKey: `refund-cancel-${booking.id}`, providerRef: `demo_rf_${randomToken(8)}` },
      });
    }
    await tx.bookingHistory.create({ data: { bookingId: booking.id, action: 'CANCELLED', actor, details: { reason, refund: paid } } });
    await enqueueEmail(tx, { bookingId: booking.id, type: 'CANCELLATION', toEmail: booking.contactEmail, subject: `Booking cancelled: ${booking.bookingCode}` });
  });
  kickEmailQueue();
  kickSalesforceSync(booking.id);
  return findBooking(booking.id);
}

export async function getHistory(bookingId) {
  return prisma.bookingHistory.findMany({ where: { bookingId }, orderBy: { createdAt: 'asc' } });
}
