/**
 * In-process background jobs (simple setInterval; fine for a single Render instance).
 * For multiple instances move these to a Render Cron Job or a queue — every job here
 * is idempotent and uses conditional updates, so overlapping runs are safe.
 */
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { reclaimableLockWhere } from '../services/inventory.js';
import { processDueEmails } from '../services/email/emailService.js';
import { retryDueSyncs } from '../services/salesforce/syncService.js';
import { confirmBooking } from '../services/bookingService.js';
import { generateSchedules } from '../services/scheduleService.js';

/** Release expired seat holds and expire abandoned bookings / quotes. */
export async function expireHolds() {
  const now = new Date();
  const locks = await prisma.seatLock.deleteMany({ where: reclaimableLockWhere(now) });
  const bookings = await prisma.booking.updateMany({
    where: { status: 'PENDING', lockExpiresAt: { lt: now }, payments: { none: { status: 'SUCCEEDED', kind: 'BOOKING' } } },
    data: { status: 'EXPIRED' },
  });
  const quotes = await prisma.rescheduleRequest.updateMany({ where: { status: 'QUOTED', expiresAt: { lt: now } }, data: { status: 'EXPIRED' } });
  if (locks.count || bookings.count || quotes.count) {
    logger.debug({ locks: locks.count, bookings: bookings.count, quotes: quotes.count }, 'Expired holds released');
  }
}

/** Recovery: a payment succeeded but the client never called /confirm (closed tab, network drop). */
export async function confirmPaidPending() {
  const stuck = await prisma.booking.findMany({
    where: { status: 'PENDING', payments: { some: { status: 'SUCCEEDED', kind: 'BOOKING' } }, updatedAt: { lt: new Date(Date.now() - 60 * 1000) } },
    select: { id: true },
    take: 10,
  });
  for (const { id } of stuck) {
    await confirmBooking({ bookingId: id, skipAccessCheck: true, actor: 'system:recovery' }).catch((err) => logger.warn({ id, err: err.message }, 'Recovery confirm failed'));
  }
}

const jobs = [
  { name: 'expire-holds', every: 30_000, fn: expireHolds },
  { name: 'confirm-paid-pending', every: 60_000, fn: confirmPaidPending },
  { name: 'email-outbox', every: 30_000, fn: processDueEmails },
  { name: 'salesforce-retry', every: 120_000, fn: retryDueSyncs },
  { name: 'generate-schedules', every: 6 * 3600_000, fn: () => generateSchedules({ days: 30 }) },
];

export function startScheduler() {
  const timers = jobs.map((job) => {
    let running = false;
    const run = async () => {
      if (running) return;
      running = true;
      try {
        await job.fn();
      } catch (err) {
        logger.error({ err, job: job.name }, 'Background job failed');
      } finally {
        running = false;
      }
    };
    setTimeout(run, 2000);
    return setInterval(run, job.every);
  });
  return () => timers.forEach(clearInterval);
}
