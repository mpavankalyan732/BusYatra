import * as bookingService from '../services/bookingService.js';
import { bookingInclude, serializeBooking } from '../services/serializers.js';
import { generateTicketPdf } from '../services/ticket/pdfService.js';
import { prisma } from '../lib/prisma.js';
import { conflict, notFound } from '../lib/errors.js';
import { toIstDateString } from '../lib/time.js';

const accessTokenOf = (req) => req.headers['x-access-token'] || req.body?.accessToken || req.query.accessToken;

export async function lockSeats(req, res) {
  const { scheduleId, seatIds, replaceBookingId } = req.body;
  const booking = await bookingService.lockSeats({ scheduleId, seatIds, user: req.user, replaceBookingId, accessToken: accessTokenOf(req) });
  res.status(201).json({ success: true, data: serializeBooking(booking, { includeAccessToken: true }) });
}

export async function releaseHold(req, res) {
  await bookingService.releaseHold({ bookingId: req.params.bookingId, accessToken: accessTokenOf(req) });
  res.json({ success: true });
}

export async function savePassengers(req, res) {
  const booking = await bookingService.savePassengers({ ...req.body, accessToken: accessTokenOf(req), user: req.user });
  res.json({ success: true, data: serializeBooking(booking) });
}

export async function confirm(req, res) {
  const booking = await bookingService.confirmBooking({ bookingId: req.body.bookingId, accessToken: accessTokenOf(req) });
  res.json({ success: true, data: serializeBooking(booking) });
}

function accessContext(req) {
  return { accessToken: accessTokenOf(req), email: req.query.email, user: req.user };
}

export async function getBooking(req, res) {
  const booking = await bookingService.findBooking(req.params.bookingId, {
    ...bookingInclude,
    history: { orderBy: { createdAt: 'asc' } },
    emails: { select: { type: true, status: true, sentAt: true, attempts: true, transport: true } },
  });
  bookingService.assertAccess(booking, accessContext(req));
  res.json({ success: true, data: { ...serializeBooking(booking, { includeHistory: true }), emails: booking.emails } });
}

export async function downloadTicket(req, res) {
  const booking = await bookingService.findBooking(req.params.bookingId);
  bookingService.assertAccess(booking, accessContext(req));
  if (booking.status !== 'CONFIRMED' && booking.status !== 'CANCELLED') throw conflict('NOT_CONFIRMED', 'Ticket is available after confirmation');
  const pdf = await generateTicketPdf(booking);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="BusYatra-${booking.bookingCode}.pdf"`);
  res.send(pdf);
}

export async function myBookings(req, res) {
  const rows = await prisma.booking.findMany({
    where: { userId: req.user.id, bookingCode: { not: null } },
    include: bookingInclude,
    orderBy: { confirmedAt: 'desc' },
  });
  res.json({ success: true, data: rows.map((b) => serializeBooking(b)) });
}

/** Public QR verification: reveals only what a conductor needs. */
export async function verifyTicket(req, res) {
  const b = await prisma.booking.findUnique({
    where: { ticketToken: req.params.token },
    include: { schedule: { include: { bus: true, route: { include: { origin: true, destination: true } } } }, passengers: { include: { seat: true } } },
  });
  if (!b) throw notFound('Ticket not found or superseded');
  res.json({
    success: true,
    data: {
      bookingCode: b.bookingCode,
      status: b.status,
      valid: b.status === 'CONFIRMED',
      route: `${b.schedule.route.origin.name} → ${b.schedule.route.destination.name}`,
      journeyDate: toIstDateString(b.schedule.departureAt),
      departureAt: b.schedule.departureAt,
      bus: `${b.schedule.bus.operatorName} · ${b.schedule.bus.registrationNo}`,
      passengers: b.passengers.map((p) => ({ seatNumber: p.seat.seatNumber, initials: p.name.split(/\s+/).map((x) => x[0]).join('').toUpperCase() })),
    },
  });
}
