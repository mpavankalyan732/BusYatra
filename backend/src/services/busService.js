import { prisma } from '../lib/prisma.js';
import { badRequest, notFound } from '../lib/errors.js';
import { istDayRange, istHour } from '../lib/time.js';
import { occupiedCounts, occupiedLockWhere } from './inventory.js';
import { durationMinutes, serializeBus, serializeSchedule } from './serializers.js';
import { seatFare } from './pricing.js';

const TIME_SLOTS = {
  NIGHT: [0, 6], // before 6 AM
  MORNING: [6, 12],
  AFTERNOON: [12, 18],
  EVENING: [18, 24],
};

const scheduleInclude = {
  bus: { include: { _count: { select: { seats: true } } } },
  route: { include: { origin: true, destination: true } },
};

/** Low-level: schedules for a route on an IST date, with availability. Used by search AND rescheduling. */
export async function findSchedulesWithAvailability({ originId, destinationId, date, notBefore = new Date() }) {
  const range = istDayRange(date);
  if (!range) throw badRequest('date must be YYYY-MM-DD');
  const [start, end] = range;
  const schedules = await prisma.busSchedule.findMany({
    where: {
      status: 'SCHEDULED',
      departureAt: { gte: start > notBefore ? start : notBefore, lt: end },
      bus: { isActive: true },
      route: { originId, destinationId, isActive: true },
    },
    include: scheduleInclude,
    orderBy: { departureAt: 'asc' },
  });
  const occupied = await occupiedCounts(prisma, schedules.map((s) => s.id));
  return schedules.map((s) => {
    const total = s.bus._count.seats;
    return { schedule: s, totalSeats: total, availableSeats: Math.max(0, total - (occupied.get(s.id) || 0)) };
  });
}

export async function searchBuses(q) {
  const rows = await findSchedulesWithAvailability({ originId: q.originId, destinationId: q.destinationId, date: q.date });

  // Facets are computed before filters so the UI can always show every option.
  const facets = {
    operators: [...new Set(rows.map((r) => r.schedule.bus.operatorName))].sort(),
    minFare: rows.length ? Math.min(...rows.map((r) => r.schedule.baseFare)) : 0,
    maxFare: rows.length ? Math.max(...rows.map((r) => r.schedule.baseFare)) : 0,
  };

  let filtered = rows.filter(({ schedule: s }) => {
    if (q.acType?.length && !q.acType.includes(s.bus.acType)) return false;
    if (q.seatClass?.length && !q.seatClass.includes(s.bus.seatClass)) return false;
    if (q.operators?.length && !q.operators.includes(s.bus.operatorName)) return false;
    if (q.minPrice != null && s.baseFare < q.minPrice * 100) return false;
    if (q.maxPrice != null && s.baseFare > q.maxPrice * 100) return false;
    if (q.departure?.length) {
      const h = istHour(s.departureAt);
      if (!q.departure.some((slot) => TIME_SLOTS[slot] && h >= TIME_SLOTS[slot][0] && h < TIME_SLOTS[slot][1])) return false;
    }
    return true;
  });

  const sorters = {
    price: (a, b) => a.schedule.baseFare - b.schedule.baseFare,
    departure: (a, b) => a.schedule.departureAt - b.schedule.departureAt,
    duration: (a, b) => durationMinutes(a.schedule) - durationMinutes(b.schedule),
    seats: (a, b) => b.availableSeats - a.availableSeats,
  };
  filtered = filtered.sort(sorters[q.sort] || sorters.departure);

  const total = filtered.length;
  const page = q.page || 1;
  const pageSize = q.pageSize || 20;
  const items = filtered
    .slice((page - 1) * pageSize, page * pageSize)
    .map((r) => serializeSchedule(r.schedule, { availableSeats: r.availableSeats, totalSeats: r.totalSeats }));

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize), facets };
}

export async function getScheduleDetails(id) {
  const s = await prisma.busSchedule.findUnique({ where: { id }, include: scheduleInclude });
  if (!s) throw notFound('Bus schedule not found');
  const occupied = await occupiedCounts(prisma, [s.id]);
  const total = s.bus._count.seats;
  return serializeSchedule(s, { availableSeats: total - (occupied.get(s.id) || 0), totalSeats: total });
}

/**
 * Seat map for a schedule. `holdBookingId` marks seats held by the caller's own
 * pending booking as "held_by_you" so they can re-edit their selection.
 */
export async function getSeatMap(scheduleId, { holdBookingId } = {}) {
  const s = await prisma.busSchedule.findUnique({
    where: { id: scheduleId },
    include: { bus: { include: { seats: true } }, route: { include: { origin: true, destination: true } } },
  });
  if (!s) throw notFound('Bus schedule not found');
  const locks = await prisma.seatLock.findMany({
    where: { scheduleId, ...occupiedLockWhere() },
    select: { seatId: true, status: true, bookingId: true },
  });
  const lockBySeat = new Map(locks.map((l) => [l.seatId, l]));

  const seats = s.bus.seats.map((seat) => {
    const lock = lockBySeat.get(seat.id);
    let status = 'available';
    if (lock) {
      if (lock.status === 'BOOKED') status = 'booked';
      else status = holdBookingId && lock.bookingId === holdBookingId ? 'held_by_you' : 'held';
    }
    return {
      id: seat.id,
      seatNumber: seat.seatNumber,
      deck: seat.deck,
      row: seat.row,
      col: seat.col,
      kind: seat.kind,
      isWindow: seat.isWindow,
      fare: seatFare(s.baseFare, seat),
      status,
    };
  });

  return {
    schedule: serializeSchedule({ ...s, bus: undefined }),
    bus: serializeBus(s.bus),
    decks: [...new Set(seats.map((x) => x.deck))],
    seats,
    availableCount: seats.filter((x) => x.status === 'available').length,
  };
}

export const listCities = () => prisma.city.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, state: true, slug: true } });
