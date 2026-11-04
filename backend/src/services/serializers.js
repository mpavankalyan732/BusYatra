import { seatSort } from '../lib/util.js';
import { toIstDateString } from '../lib/time.js';

export const durationMinutes = (s) => Math.round((new Date(s.arrivalAt) - new Date(s.departureAt)) / 60000);

export function serializeBus(bus) {
  return {
    id: bus.id,
    operatorName: bus.operatorName,
    registrationNo: bus.registrationNo,
    serviceCode: bus.serviceCode,
    acType: bus.acType,
    seatClass: bus.seatClass,
    layoutTemplate: bus.layoutTemplate,
    amenities: bus.amenities,
    rating: bus.rating,
    isActive: bus.isActive,
    totalSeats: bus._count?.seats ?? bus.seats?.length,
  };
}

export function serializeSchedule(s, extra = {}) {
  return {
    id: s.id,
    departureAt: s.departureAt,
    arrivalAt: s.arrivalAt,
    journeyDate: toIstDateString(s.departureAt),
    durationMinutes: durationMinutes(s),
    baseFare: s.baseFare,
    status: s.status,
    bus: s.bus ? serializeBus(s.bus) : undefined,
    route: s.route
      ? {
          id: s.route.id,
          origin: s.route.origin && { id: s.route.origin.id, name: s.route.origin.name },
          destination: s.route.destination && { id: s.route.destination.id, name: s.route.destination.name },
          distanceKm: s.route.distanceKm,
          boardingPoints: s.route.boardingPoints,
          droppingPoints: s.route.droppingPoints,
        }
      : undefined,
    ...extra,
  };
}

/** Prisma include used everywhere a full booking is needed */
export const bookingInclude = {
  schedule: { include: { bus: true, route: { include: { origin: true, destination: true } } } },
  passengers: { include: { seat: true } },
  payments: { orderBy: { createdAt: 'asc' } },
  locks: { include: { seat: true } },
};

export function paymentStatusOf(booking) {
  const p = (booking.payments || []).filter((x) => x.kind === 'BOOKING');
  if (p.some((x) => x.status === 'SUCCEEDED')) {
    return booking.status === 'CANCELLED' ? 'REFUNDED' : 'PAID';
  }
  const last = p[p.length - 1];
  return last ? last.status : 'NOT_STARTED';
}

export function serializeBooking(b, { includeHistory = false, includeAccessToken = false } = {}) {
  const passengers = (b.passengers || [])
    .map((p) => ({ id: p.id, name: p.name, age: p.age, gender: p.gender, seatId: p.seatId, seatNumber: p.seat?.seatNumber }))
    .sort((a, b2) => seatSort(a.seatNumber || '', b2.seatNumber || ''));
  const heldSeats = (b.locks || [])
    .filter((l) => l.scheduleId === b.scheduleId)
    .map((l) => ({ id: l.seatId, seatNumber: l.seat?.seatNumber, priceDelta: l.seat?.priceDelta, deck: l.seat?.deck }))
    .sort((a, b2) => seatSort(a.seatNumber || '', b2.seatNumber || ''));
  const seatNumbers = passengers.length ? passengers.map((p) => p.seatNumber) : heldSeats.map((s) => s.seatNumber);

  return {
    id: b.id,
    bookingCode: b.bookingCode,
    status: b.status,
    paymentStatus: paymentStatusOf(b),
    ...(includeAccessToken ? { accessToken: b.accessToken } : {}),
    schedule: b.schedule ? serializeSchedule(b.schedule) : undefined,
    seats: heldSeats,
    seatNumbers,
    seatCount: b.seatCount,
    passengers,
    contact: { name: b.contactName, email: b.contactEmail, phone: b.contactPhone },
    fare: { baseAmount: b.baseAmount, taxAmount: b.taxAmount, feeAmount: b.feeAmount, totalAmount: b.totalAmount },
    lockExpiresAt: b.status === 'PENDING' ? b.lockExpiresAt : null,
    confirmedAt: b.confirmedAt,
    cancelledAt: b.cancelledAt,
    rescheduleCount: b.rescheduleCount,
    salesforce: { status: b.sfSyncStatus, attempts: b.sfSyncAttempts, lastError: b.sfLastError, syncedAt: b.sfSyncedAt },
    payments: (b.payments || []).map((p) => ({
      id: p.id,
      kind: p.kind,
      method: p.method,
      status: p.status,
      amount: p.amount,
      maskedInstrument: p.maskedInstrument,
      failureReason: p.failureReason,
      createdAt: p.createdAt,
    })),
    ...(includeHistory && b.history ? { history: b.history } : {}),
    createdAt: b.createdAt,
  };
}
