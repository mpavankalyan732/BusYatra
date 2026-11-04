import { prisma } from '../../lib/prisma.js';
import { conflict, forbidden, gone, isUniqueViolation, notFound } from '../../lib/errors.js';
import { randomToken, safeEqual } from '../../lib/util.js';
import { logger } from '../../lib/logger.js';
import { getPaymentProvider } from './providers/index.js';

const EXTEND_AFTER_PAYMENT_MS = 5 * 60 * 1000;

async function loadBookingForPayment(bookingId, accessToken) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { payments: true, passengers: true } });
  if (!booking) throw notFound('Booking not found');
  if (!safeEqual(accessToken || '', booking.accessToken)) throw forbidden('Invalid booking access token');
  return booking;
}

/** Step 1: create a payment intent. Idempotent per Idempotency-Key header. */
export async function createPayment({ bookingId, accessToken, method, idempotencyKey }) {
  const booking = await loadBookingForPayment(bookingId, accessToken);
  if (booking.payments.some((p) => p.kind === 'BOOKING' && p.status === 'SUCCEEDED')) {
    throw conflict('ALREADY_PAID', 'This booking has already been paid');
  }
  if (booking.status !== 'PENDING') throw conflict('NOT_PENDING', `Booking is ${booking.status.toLowerCase()}`);
  if (!booking.passengers.length || !booking.contactEmail) throw conflict('PASSENGERS_REQUIRED', 'Add passenger details before payment');
  if (booking.lockExpiresAt < new Date()) throw gone('HOLD_EXPIRED', 'Your seat hold has expired. Please select seats again.');

  const key = idempotencyKey ? `${booking.id}:${idempotencyKey}` : `${booking.id}:${randomToken(12)}`;
  const existing = await prisma.payment.findUnique({ where: { idempotencyKey: key } });
  if (existing) return existing;

  // Abandon any older un-attempted intents so only one is live at a time.
  await prisma.payment.updateMany({
    where: { bookingId: booking.id, status: 'CREATED' },
    data: { status: 'FAILED', failureReason: 'Superseded by a newer payment attempt' },
  });
  return prisma.payment.create({
    data: { bookingId: booking.id, kind: 'BOOKING', method, amount: booking.totalAmount, idempotencyKey: key },
  });
}

/**
 * Step 2: process & verify. The status transition CREATED -> PROCESSING is done with a
 * conditional update, so double-clicks / parallel requests cannot charge twice.
 */
export async function processPayment({ paymentId, accessToken, details }) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId }, include: { booking: true } });
  if (!payment) throw notFound('Payment not found');
  if (!safeEqual(accessToken || '', payment.booking.accessToken)) throw forbidden('Invalid booking access token');
  if (payment.status === 'SUCCEEDED' || payment.status === 'FAILED') return payment; // idempotent replay
  if (payment.booking.lockExpiresAt < new Date()) {
    return prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED', failureReason: 'Seat hold expired before payment' } });
  }

  const claimed = await prisma.payment.updateMany({ where: { id: payment.id, status: 'CREATED' }, data: { status: 'PROCESSING' } });
  if (claimed.count === 0) throw conflict('PAYMENT_IN_PROGRESS', 'This payment is already being processed');

  let result;
  try {
    result = await getPaymentProvider().charge({ method: payment.method, amount: payment.amount, currency: payment.currency, details, idempotencyKey: payment.idempotencyKey });
  } catch (err) {
    logger.error({ err, paymentId }, 'Payment provider error');
    result = { status: 'FAILED', failureReason: 'Payment provider unavailable' };
  }

  try {
    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: result.status,
        providerRef: result.providerRef,
        maskedInstrument: result.maskedInstrument,
        failureReason: result.failureReason || null,
      },
    });
    if (updated.status === 'SUCCEEDED') {
      // Give the confirm step a safe window; holds of paid bookings are never reclaimed anyway.
      const until = new Date(Date.now() + EXTEND_AFTER_PAYMENT_MS);
      await prisma.$transaction([
        prisma.seatLock.updateMany({ where: { bookingId: payment.bookingId, status: 'HELD' }, data: { expiresAt: until } }),
        prisma.booking.update({ where: { id: payment.bookingId }, data: { lockExpiresAt: until } }),
        prisma.bookingHistory.create({ data: { bookingId: payment.bookingId, action: 'PAYMENT_SUCCEEDED', actor: 'customer', details: { paymentId: payment.id, method: payment.method, amount: payment.amount } } }),
      ]);
    } else {
      await prisma.bookingHistory.create({ data: { bookingId: payment.bookingId, action: 'PAYMENT_FAILED', actor: 'customer', details: { paymentId: payment.id, reason: result.failureReason } } });
    }
    return updated;
  } catch (err) {
    // Partial unique index: another payment for this booking already succeeded.
    if (isUniqueViolation(err)) {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: 'REFUNDED', failureReason: 'Duplicate payment - auto refunded (demo)' } });
      throw conflict('ALREADY_PAID', 'This booking was already paid; the duplicate charge was refunded');
    }
    throw err;
  }
}

export const getPayment = (id) => prisma.payment.findUnique({ where: { id } });
