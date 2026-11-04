import * as admin from '../services/adminService.js';
import { cancelBooking, findBooking } from '../services/bookingService.js';
import { serializeBooking } from '../services/serializers.js';
import { syncBooking } from '../services/salesforce/syncService.js';
import { prisma } from '../lib/prisma.js';

const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });

export const stats = async (_req, res) => ok(res, await admin.dashboardStats());
export const bookings = async (req, res) => ok(res, await admin.listBookings(req.validQuery));
export const cancel = async (req, res) =>
  ok(res, serializeBooking(await cancelBooking({ bookingId: req.params.id, actor: `admin:${req.user.id}`, reason: req.body.reason })));
export const resync = async (req, res) => {
  const b = await findBooking(req.params.id);
  await prisma.booking.update({ where: { id: b.id }, data: { sfSyncAttempts: 0 } });
  ok(res, await syncBooking(b.id));
};

export const layouts = (_req, res) => ok(res, admin.layoutTemplates());
export const buses = async (_req, res) => ok(res, await admin.listBuses());
export const createBus = async (req, res) => ok(res, await admin.createBus(req.body), 201);
export const updateBus = async (req, res) => ok(res, await admin.updateBus(req.params.id, req.body));
export const changeLayout = async (req, res) => ok(res, await admin.changeLayout(req.params.id, req.body.layoutTemplate));

export const routes = async (_req, res) => ok(res, await admin.listRoutes());
export const createRoute = async (req, res) => ok(res, await admin.createRoute(req.body), 201);
export const updateRoute = async (req, res) => ok(res, await admin.updateRoute(req.params.id, req.body));

export const schedules = async (req, res) => ok(res, await admin.listSchedules(req.validQuery));
export const recurring = async (_req, res) => ok(res, await admin.listRecurring());
export const createSchedule = async (req, res) => ok(res, await admin.createSchedule(req.body), 201);
export const cancelSchedule = async (req, res) => ok(res, await admin.cancelSchedule(req.params.id));
