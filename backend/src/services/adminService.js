import { prisma } from '../lib/prisma.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import { buildLayout, LAYOUT_TEMPLATES } from '../lib/layouts.js';
import { istDateTime, istHHmm } from '../lib/time.js';
import { bookingInclude, serializeBooking, serializeBus, serializeSchedule } from './serializers.js';
import { generateSchedules } from './scheduleService.js';

// ---------------------------------------------------------------- dashboard

export async function dashboardStats() {
  const now = new Date();
  const [confirmed, cancelled, pending, passengers, activeBuses, upcomingSchedules, payments, sync, recent, payStatus] = await Promise.all([
    prisma.booking.count({ where: { status: 'CONFIRMED' } }),
    prisma.booking.count({ where: { status: 'CANCELLED' } }),
    prisma.booking.count({ where: { status: 'PENDING' } }),
    prisma.passenger.count({ where: { booking: { status: 'CONFIRMED' } } }),
    prisma.bus.count({ where: { isActive: true } }),
    prisma.busSchedule.count({ where: { status: 'SCHEDULED', departureAt: { gt: now } } }),
    prisma.payment.groupBy({ by: ['kind'], where: { status: 'SUCCEEDED' }, _sum: { amount: true } }),
    prisma.booking.groupBy({ by: ['sfSyncStatus'], where: { bookingCode: { not: null } }, _count: { _all: true } }),
    prisma.booking.findMany({ where: { bookingCode: { not: null } }, include: bookingInclude, orderBy: { confirmedAt: 'desc' }, take: 8 }),
    prisma.payment.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);
  const sum = (k) => payments.find((p) => p.kind === k)?._sum.amount || 0;
  return {
    totals: {
      bookings: confirmed + cancelled,
      confirmed,
      cancelled,
      pending,
      revenue: sum('BOOKING') + sum('ADJUSTMENT') - sum('REFUND'),
      passengers,
      activeBuses,
      upcomingSchedules,
    },
    salesforceSync: Object.fromEntries(sync.map((s) => [s.sfSyncStatus, s._count._all])),
    paymentStatus: Object.fromEntries(payStatus.map((s) => [s.status, s._count._all])),
    recentBookings: recent.map((b) => serializeBooking(b)),
  };
}

export async function listBookings({ status, q, page = 1, pageSize = 20 }) {
  const where = {
    bookingCode: { not: null },
    ...(status ? { status } : {}),
    ...(q ? { OR: [{ bookingCode: { contains: q.toUpperCase() } }, { contactEmail: { contains: q.toLowerCase() } }, { contactName: { contains: q, mode: 'insensitive' } }] } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.booking.count({ where }),
    prisma.booking.findMany({ where, include: { ...bookingInclude, history: { orderBy: { createdAt: 'asc' } } }, orderBy: { confirmedAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
  ]);
  return { items: rows.map((b) => serializeBooking(b, { includeHistory: true })), total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

// ---------------------------------------------------------------- buses & layouts

export const layoutTemplates = () =>
  Object.entries(LAYOUT_TEMPLATES).map(([key, t]) => {
    const seats = t.build().map((s) => ({ ...s, id: s.seatNumber, status: 'available', fare: s.priceDelta }));
    return { key, label: t.label, seatClass: t.seatClass, seatCount: seats.length, seats };
  });

export async function listBuses() {
  const buses = await prisma.bus.findMany({ include: { _count: { select: { seats: true, schedules: true } } }, orderBy: [{ operatorName: 'asc' }, { serviceCode: 'asc' }] });
  return buses.map((b) => ({ ...serializeBus(b), scheduleCount: b._count.schedules }));
}

export async function createBus(data) {
  if (!LAYOUT_TEMPLATES[data.layoutTemplate]) throw badRequest('Unknown layout template');
  const bus = await prisma.bus.create({
    data: {
      operatorName: data.operatorName,
      registrationNo: data.registrationNo.toUpperCase(),
      serviceCode: data.serviceCode.toUpperCase(),
      acType: data.acType,
      seatClass: LAYOUT_TEMPLATES[data.layoutTemplate].seatClass,
      layoutTemplate: data.layoutTemplate,
      amenities: data.amenities || [],
      rating: data.rating ?? 4.2,
      seats: { create: buildLayout(data.layoutTemplate) },
    },
    include: { _count: { select: { seats: true } } },
  });
  return serializeBus(bus);
}

export async function updateBus(id, data) {
  const bus = await prisma.bus.update({
    where: { id },
    data: {
      operatorName: data.operatorName,
      registrationNo: data.registrationNo?.toUpperCase(),
      acType: data.acType,
      amenities: data.amenities,
      rating: data.rating,
      isActive: data.isActive,
    },
    include: { _count: { select: { seats: true } } },
  });
  return serializeBus(bus);
}

/** Replace a bus's seat layout. Only allowed when no seats are held/booked on future trips. */
export async function changeLayout(id, layoutTemplate) {
  if (!LAYOUT_TEMPLATES[layoutTemplate]) throw badRequest('Unknown layout template');
  const locks = await prisma.seatLock.count({ where: { seat: { busId: id } } });
  const pax = await prisma.passenger.count({ where: { seat: { busId: id } } });
  if (locks || pax) throw conflict('LAYOUT_IN_USE', 'This bus has seats held or booked. Create a new bus for the new layout instead.');
  await prisma.$transaction([
    prisma.busSeat.deleteMany({ where: { busId: id } }),
    prisma.bus.update({
      where: { id },
      data: { layoutTemplate, seatClass: LAYOUT_TEMPLATES[layoutTemplate].seatClass, seats: { create: buildLayout(layoutTemplate) } },
    }),
  ]);
  return serializeBus(await prisma.bus.findUnique({ where: { id }, include: { _count: { select: { seats: true } } } }));
}

// ---------------------------------------------------------------- routes

export async function listRoutes() {
  const routes = await prisma.busRoute.findMany({ include: { origin: true, destination: true, _count: { select: { schedules: true } } }, orderBy: [{ origin: { name: 'asc' } }] });
  return routes.map((r) => ({ ...r, scheduleCount: r._count.schedules, _count: undefined }));
}

export async function createRoute(data) {
  if (data.originId === data.destinationId) throw badRequest('Origin and destination must differ');
  return prisma.busRoute.create({ data, include: { origin: true, destination: true } });
}

export const updateRoute = (id, data) => prisma.busRoute.update({ where: { id }, data, include: { origin: true, destination: true } });

// ---------------------------------------------------------------- schedules

export async function listSchedules({ routeId, date, page = 1, pageSize = 50 }) {
  const where = {
    ...(routeId ? { routeId } : {}),
    ...(date ? { departureAt: { gte: new Date(`${date}T00:00:00+05:30`), lt: new Date(new Date(`${date}T00:00:00+05:30`).getTime() + 864e5) } } : { departureAt: { gte: new Date() } }),
  };
  const [total, rows] = await Promise.all([
    prisma.busSchedule.count({ where }),
    prisma.busSchedule.findMany({ where, include: { bus: true, route: { include: { origin: true, destination: true } }, _count: { select: { locks: true } } }, orderBy: { departureAt: 'asc' }, skip: (page - 1) * pageSize, take: pageSize }),
  ]);
  return { items: rows.map((s) => serializeSchedule(s, { occupiedSeats: s._count.locks })), total, page, pageSize };
}

export async function listRecurring() {
  const rows = await prisma.recurringSchedule.findMany({ include: { bus: true, route: { include: { origin: true, destination: true } } }, orderBy: { departureTime: 'asc' } });
  return rows;
}

/**
 * Create either a one-off trip ({date}) or a daily recurring departure ({recurring:true}).
 */
export async function createSchedule({ busId, routeId, departureTime, baseFare, date, recurring, days = 30 }) {
  const [bus, route] = await Promise.all([prisma.bus.findUnique({ where: { id: busId } }), prisma.busRoute.findUnique({ where: { id: routeId } })]);
  if (!bus) throw notFound('Bus not found');
  if (!route) throw notFound('Route not found');
  const fare = Math.round(baseFare * 100);

  if (recurring) {
    const r = await prisma.recurringSchedule.upsert({
      where: { busId_routeId_departureTime: { busId, routeId, departureTime } },
      update: { baseFare: fare, isActive: true },
      create: { busId, routeId, departureTime, baseFare: fare },
    });
    const created = await generateSchedules({ days, recurringIds: [r.id] });
    return { recurring: r, created };
  }
  if (!date) throw badRequest('date is required for a one-off schedule');
  const departureAt = istDateTime(date, departureTime);
  if (departureAt < new Date()) throw badRequest('Departure must be in the future');
  try {
    const s = await prisma.busSchedule.create({
      data: { busId, routeId, departureAt, arrivalAt: new Date(departureAt.getTime() + route.durationMinutes * 60000), baseFare: fare },
    });
    return { schedule: s, created: 1 };
  } catch (err) {
    if (err.code === 'P2002') throw conflict('DUPLICATE_SCHEDULE', `This bus already departs at ${istHHmm(departureAt)} on ${date}`);
    throw err;
  }
}

export async function cancelSchedule(id) {
  const booked = await prisma.seatLock.count({ where: { scheduleId: id, status: 'BOOKED', bookingId: { not: null } } });
  if (booked) throw conflict('SCHEDULE_HAS_BOOKINGS', `This trip has ${booked} booked seat(s). Cancel those bookings first.`);
  return prisma.busSchedule.update({ where: { id }, data: { status: 'CANCELLED' } });
}
