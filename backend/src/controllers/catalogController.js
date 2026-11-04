import { prisma } from '../lib/prisma.js';
import { badRequest, notFound } from '../lib/errors.js';
import * as busService from '../services/busService.js';

export async function listCities(_req, res) {
  res.json({ success: true, data: await busService.listCities() });
}

async function resolveCity(v) {
  const where = /^\d+$/.test(String(v)) ? { id: Number(v) } : { slug: String(v).toLowerCase() };
  const city = await prisma.city.findUnique({ where });
  if (!city) throw notFound(`City "${v}" not found`);
  return city;
}

export async function searchBuses(req, res) {
  const q = req.validQuery;
  const [origin, destination] = await Promise.all([resolveCity(q.from), resolveCity(q.to)]);
  if (origin.id === destination.id) throw badRequest('Origin and destination must be different');
  const result = await busService.searchBuses({ ...q, originId: origin.id, destinationId: destination.id });
  res.json({ success: true, data: { ...result, origin, destination, date: q.date } });
}

export async function getBus(req, res) {
  res.json({ success: true, data: await busService.getScheduleDetails(req.params.id) });
}

export async function getSeats(req, res) {
  res.json({ success: true, data: await busService.getSeatMap(req.params.id, { holdBookingId: req.query.holdBookingId }) });
}
