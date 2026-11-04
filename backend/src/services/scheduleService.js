import { prisma } from '../lib/prisma.js';
import { addDays, istDateTime, todayIst } from '../lib/time.js';

/**
 * Materialise RecurringSchedule rows into concrete BusSchedule rows for the next `days` days.
 * Idempotent thanks to UNIQUE(busId, departureAt) + skipDuplicates.
 */
export async function generateSchedules({ days = 30, recurringIds } = {}) {
  const recurring = await prisma.recurringSchedule.findMany({
    where: { isActive: true, ...(recurringIds ? { id: { in: recurringIds } } : {}) },
    include: { route: true },
  });
  const today = todayIst();
  const data = [];
  for (const r of recurring) {
    for (let d = 0; d < days; d++) {
      const departureAt = istDateTime(addDays(today, d), r.departureTime);
      data.push({
        busId: r.busId,
        routeId: r.routeId,
        departureAt,
        arrivalAt: new Date(departureAt.getTime() + r.route.durationMinutes * 60000),
        baseFare: r.baseFare,
      });
    }
  }
  let created = 0;
  for (let i = 0; i < data.length; i += 1000) {
    const res = await prisma.busSchedule.createMany({ data: data.slice(i, i + 1000), skipDuplicates: true });
    created += res.count;
  }
  return created;
}
