import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { asyncHandler as h } from '../lib/errors.js';
import { validate } from '../middleware/validate.js';
import { optionalAuth, requireAgentApiKey } from '../middleware/auth.js';
import { config, salesforceConfigured, smtpConfigured } from '../config/env.js';
import * as catalog from '../controllers/catalogController.js';
import * as bookings from '../controllers/bookingController.js';
import * as payments from '../controllers/paymentController.js';
import * as adminCtl from '../controllers/adminController.js';
import { activeProvider } from '../services/agent/agentService.js';

const router = Router();
const limiter = (max, windowMin = 15) => rateLimit({ windowMs: windowMin * 60_000, max, standardHeaders: true, legacyHeaders: false });

// ---------------------------------------------------------------- shared schemas
const id = z.string().min(1).max(64);
const csv = (values) => z.preprocess((v) => (typeof v === 'string' && v ? v.split(',') : Array.isArray(v) ? v : undefined), z.array(z.enum(values)).optional());
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD');
const money = z.coerce.number().nonnegative();

// ---------------------------------------------------------------- health
router.get('/health', (_req, res) =>
  res.json({
    success: true,
    data: {
      status: 'ok',
      time: new Date().toISOString(),
      integrations: {
        smtp: smtpConfigured() ? 'configured' : 'dev-log (not configured)',
        salesforce: salesforceConfigured() ? 'configured' : 'not configured',
        agent: activeProvider().name,
        payments: 'demo simulator',
      },
    },
  }),
);

// ---------------------------------------------------------------- catalog
router.get('/cities', h(catalog.listCities));
router.get(
  '/buses/search',
  validate({
    query: z.object({
      from: z.string().min(1),
      to: z.string().min(1),
      date: dateStr,
      acType: csv(['AC', 'NON_AC']),
      seatClass: csv(['SEATER', 'SEMI_SLEEPER', 'SLEEPER']),
      departure: csv(['NIGHT', 'MORNING', 'AFTERNOON', 'EVENING']),
      operators: z.preprocess((v) => (typeof v === 'string' && v ? v.split(',') : v), z.array(z.string()).optional()),
      minPrice: money.optional(),
      maxPrice: money.optional(),
      sort: z.enum(['price', 'departure', 'duration', 'seats']).optional(),
      page: z.coerce.number().int().min(1).optional(),
      pageSize: z.coerce.number().int().min(1).max(50).optional(),
    }),
  }),
  h(catalog.searchBuses),
);
router.get('/buses/:id', h(catalog.getBus));
router.get('/buses/:id/seats', h(catalog.getSeats));

// ---------------------------------------------------------------- bookings
router.post(
  '/bookings/lock-seats',
  optionalAuth,
  limiter(120),
  validate({ body: z.object({ scheduleId: id, seatIds: z.array(id).min(1).max(config.booking.maxSeatsPerBooking), replaceBookingId: id.optional() }) }),
  h(bookings.lockSeats),
);
router.post(
  '/bookings/passengers',
  optionalAuth,
  validate({
    body: z.object({
      bookingId: id,
      contact: z.object({ email: z.string().email().max(120), phone: z.string().regex(/^[6-9]\d{9}$/, 'must be a 10-digit Indian mobile number') }),
      passengers: z
        .array(z.object({ seatId: id, name: z.string().trim().min(2).max(80).regex(/^[\p{L} .'-]+$/u, 'contains invalid characters'), age: z.coerce.number().int().min(1).max(120), gender: z.enum(['MALE', 'FEMALE', 'OTHER']) }))
        .min(1)
        .max(config.booking.maxSeatsPerBooking),
    }),
  }),
  h(bookings.savePassengers),
);
router.post('/bookings/confirm', validate({ body: z.object({ bookingId: id }) }), h(bookings.confirm));
router.get('/bookings/:bookingId', optionalAuth, limiter(200), h(bookings.getBooking));
router.get('/bookings/:bookingId/ticket.pdf', optionalAuth, h(bookings.downloadTicket));
router.delete('/bookings/:bookingId/hold', h(bookings.releaseHold));

router.get('/tickets/verify/:token', limiter(100), h(bookings.verifyTicket));

// ---------------------------------------------------------------- payments (DEMO)
router.get('/payments/test-instruments', payments.testInstruments);
router.post('/payments/create', limiter(60), validate({ body: z.object({ bookingId: id, method: z.enum(['CARD', 'UPI']) }) }), h(payments.create));
router.post(
  '/payments/verify',
  limiter(60),
  validate({
    body: z.object({
      paymentId: id,
      card: z.object({ cardNumber: z.string().max(23), expiry: z.string().regex(/^\d{2}\/\d{2}$/, 'must be MM/YY'), cvv: z.string().regex(/^\d{3,4}$/), name: z.string().max(80) }).optional(),
      upi: z.object({ upiId: z.string().max(80) }).optional(),
    }),
  }),
  h(payments.verify),
);
router.post('/payments/upi/verify', limiter(60), validate({ body: z.object({ upiId: z.string().min(3).max(80) }) }), payments.verifyUpi);

// ---------------------------------------------------------------- admin
const admin = Router();
admin.get('/stats', h(adminCtl.stats));
admin.get('/bookings', validate({ query: z.object({ status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED']).optional(), q: z.string().max(80).optional(), page: z.coerce.number().int().min(1).optional(), pageSize: z.coerce.number().int().min(1).max(100).optional() }) }), h(adminCtl.bookings));
admin.post('/bookings/:id/cancel', validate({ body: z.object({ reason: z.string().max(300).optional() }) }), h(adminCtl.cancel));
admin.post('/bookings/:id/resync', h(adminCtl.resync));
admin.get('/layouts', adminCtl.layouts);
admin.get('/buses', h(adminCtl.buses));
const busBody = z.object({
  operatorName: z.string().min(2).max(80),
  registrationNo: z.string().min(4).max(20),
  serviceCode: z.string().min(2).max(20),
  acType: z.enum(['AC', 'NON_AC']),
  layoutTemplate: z.string(),
  amenities: z.array(z.string().max(40)).max(15).optional(),
  rating: z.number().min(0).max(5).optional(),
});
admin.post('/buses', validate({ body: busBody }), h(adminCtl.createBus));
admin.put('/buses/:id', validate({ body: busBody.omit({ layoutTemplate: true, serviceCode: true }).partial().extend({ isActive: z.boolean().optional() }) }), h(adminCtl.updateBus));
admin.put('/buses/:id/layout', validate({ body: z.object({ layoutTemplate: z.string() }) }), h(adminCtl.changeLayout));
admin.get('/routes', h(adminCtl.routes));
const routeBody = z.object({
  originId: z.number().int(),
  destinationId: z.number().int(),
  distanceKm: z.number().int().positive(),
  durationMinutes: z.number().int().min(15).max(3000),
  boardingPoints: z.array(z.string().max(80)).min(1).max(10),
  droppingPoints: z.array(z.string().max(80)).min(1).max(10),
  isActive: z.boolean().optional(),
});
admin.post('/routes', validate({ body: routeBody }), h(adminCtl.createRoute));
admin.put('/routes/:id', validate({ body: routeBody.partial() }), h(adminCtl.updateRoute));
admin.get('/schedules', validate({ query: z.object({ routeId: z.string().optional(), date: dateStr.optional(), page: z.coerce.number().int().min(1).optional() }) }), h(adminCtl.schedules));
admin.get('/schedules/recurring', h(adminCtl.recurring));
admin.post(
  '/schedules',
  validate({
    body: z.object({
      busId: id,
      routeId: id,
      departureTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'must be HH:mm'),
      baseFare: z.number().positive().max(20000),
      recurring: z.boolean().optional(),
      date: dateStr.optional(),
      days: z.number().int().min(1).max(90).optional(),
    }),
  }),
  h(adminCtl.createSchedule),
);
admin.post('/schedules/:id/cancel', h(adminCtl.cancelSchedule));
router.use('/admin', admin);

export default router;
