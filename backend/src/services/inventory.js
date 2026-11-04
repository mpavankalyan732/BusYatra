/**
 * Shared seat-inventory predicates.
 *
 * A seat on a schedule is OCCUPIED when a SeatLock row exists that is:
 *   - BOOKED, or
 *   - HELD and not yet expired, or
 *   - HELD (even if expired) for a booking whose payment already succeeded
 *     (confirmation is in-flight; we must not resell the seat).
 *
 * Expired HELD locks without a successful payment may be reclaimed by anyone.
 */
export const occupiedLockWhere = (now = new Date()) => ({
  OR: [
    { status: 'BOOKED' },
    { status: 'HELD', expiresAt: { gt: now } },
    { status: 'HELD', booking: { is: { payments: { some: { status: 'SUCCEEDED', kind: 'BOOKING' } } } } },
  ],
});

export const reclaimableLockWhere = (now = new Date()) => ({
  status: 'HELD',
  expiresAt: { lt: now },
  OR: [{ bookingId: null }, { booking: { is: { payments: { none: { status: 'SUCCEEDED', kind: 'BOOKING' } } } } }],
});

/** Map scheduleId -> number of occupied seats */
export async function occupiedCounts(db, scheduleIds, now = new Date()) {
  if (!scheduleIds.length) return new Map();
  const rows = await db.seatLock.groupBy({
    by: ['scheduleId'],
    where: { scheduleId: { in: scheduleIds }, ...occupiedLockWhere(now) },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.scheduleId, r._count._all]));
}
