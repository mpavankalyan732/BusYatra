/**
 * Seed data: cities, routes, buses (with seat layouts), daily recurring departures,
 * 30 days of schedules, some pre-sold seats, an admin and a demo user.
 * Re-runnable: existing rows are kept; schedules are topped up for the next 30 days.
 * Operators below are fictional.
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { buildLayout, LAYOUT_TEMPLATES } from '../src/lib/layouts.js';
import { generateSchedules } from '../src/services/scheduleService.js';

const prisma = new PrismaClient();

// Deterministic PRNG so every environment gets the same data
let seed = 20261103;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

const CITIES = [
  ['Tirupati', 'Andhra Pradesh'], ['Bangalore', 'Karnataka'], ['Chennai', 'Tamil Nadu'], ['Hyderabad', 'Telangana'],
  ['Vijayawada', 'Andhra Pradesh'], ['Visakhapatnam', 'Andhra Pradesh'], ['Coimbatore', 'Tamil Nadu'], ['Mysuru', 'Karnataka'],
  ['Mumbai', 'Maharashtra'], ['Pune', 'Maharashtra'], ['Goa', 'Goa'], ['Delhi', 'Delhi'], ['Jaipur', 'Rajasthan'], ['Madurai', 'Tamil Nadu'],
];

// [from, to, km, minutes, boarding points (from), dropping points (to)]
const ROUTES = [
  ['Tirupati', 'Bangalore', 250, 330],
  ['Tirupati', 'Chennai', 140, 210],
  ['Tirupati', 'Hyderabad', 560, 660],
  ['Tirupati', 'Vijayawada', 400, 480],
  ['Bangalore', 'Chennai', 350, 390],
  ['Bangalore', 'Hyderabad', 570, 600],
  ['Bangalore', 'Mysuru', 145, 195],
  ['Bangalore', 'Goa', 560, 660],
  ['Bangalore', 'Coimbatore', 365, 420],
  ['Chennai', 'Coimbatore', 505, 540],
  ['Chennai', 'Madurai', 460, 510],
  ['Hyderabad', 'Vijayawada', 275, 330],
  ['Hyderabad', 'Visakhapatnam', 620, 720],
  ['Mumbai', 'Pune', 150, 210],
  ['Mumbai', 'Goa', 590, 720],
  ['Pune', 'Goa', 450, 600],
  ['Delhi', 'Jaipur', 280, 330],
];

const POINTS = {
  Tirupati: ['RTC Bus Stand', 'Alipiri', 'Renigunta Junction'],
  Bangalore: ['Majestic', 'Silk Board', 'Electronic City', 'Hebbal'],
  Chennai: ['Koyambedu', 'Guindy', 'Porur'],
  Hyderabad: ['Ameerpet', 'Kukatpally', 'LB Nagar', 'Miyapur'],
  Vijayawada: ['Pandit Nehru Bus Station', 'Benz Circle'],
  Visakhapatnam: ['Dwaraka Bus Station', 'Maddilapalem'],
  Coimbatore: ['Gandhipuram', 'Ukkadam'],
  Mysuru: ['Mysuru Bus Stand', 'Hunsur Road'],
  Mumbai: ['Dadar', 'Borivali', 'Sion'],
  Pune: ['Swargate', 'Wakad', 'Shivajinagar'],
  Goa: ['Panaji', 'Mapusa', 'Margao'],
  Delhi: ['Kashmere Gate ISBT', 'Dhaula Kuan'],
  Jaipur: ['Sindhi Camp', 'Narayan Singh Circle'],
  Madurai: ['Mattuthavani', 'Arapalayam'],
};

const OPERATORS = ['Garuda Roadways', 'Deccan Star Travels', 'Kaveri Express', 'Seven Hills Travels', 'Coastal Comfort Lines', 'NightRider Sleepers', 'Swift Intercity', 'Konkan Crest Coaches'];

const BUS_KINDS = [
  { acType: 'AC', layoutTemplate: 'SLEEPER_2X1_30', perKm: 2.6, amenities: ['WiFi', 'Charging Point', 'Blanket', 'Water Bottle', 'Reading Light', 'CCTV'] },
  { acType: 'AC', layoutTemplate: 'SEMI_SLEEPER_2X2_36', perKm: 2.0, amenities: ['Charging Point', 'Water Bottle', 'CCTV', 'Movie'] },
  { acType: 'AC', layoutTemplate: 'SEATER_2X2_40', perKm: 1.7, amenities: ['Charging Point', 'Water Bottle'] },
  { acType: 'NON_AC', layoutTemplate: 'SLEEPER_2X1_30', perKm: 1.9, amenities: ['Charging Point', 'Reading Light'] },
  { acType: 'NON_AC', layoutTemplate: 'SEATER_2X2_40', perKm: 1.2, amenities: ['Charging Point'] },
];

const DEPARTURES_OVERNIGHT = ['19:30', '21:00', '22:15', '23:30', '06:00'];
const DEPARTURES_SHORT = ['06:00', '09:30', '13:00', '17:30', '22:00'];
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');

async function main() {
  console.log('Seeding cities...');
  for (const [name, state] of CITIES) {
    await prisma.city.upsert({ where: { name }, update: {}, create: { name, state, slug: slug(name) } });
  }
  const cityId = Object.fromEntries((await prisma.city.findMany()).map((c) => [c.name, c.id]));

  console.log('Seeding users...');
  const adminEmail = (process.env.SEED_ADMIN_EMAIL || 'admin@busyatra.dev').toLowerCase();
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: 'ADMIN' },
    create: { name: 'BusYatra Admin', email: adminEmail, role: 'ADMIN', passwordHash: await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD || 'Admin@12345', 10) },
  });
  await prisma.user.upsert({
    where: { email: 'demo@busyatra.dev' },
    update: {},
    create: { name: 'Demo Traveller', email: 'demo@busyatra.dev', phone: '9876543210', passwordHash: await bcrypt.hash('Demo@12345', 10) },
  });

  const existingBuses = await prisma.bus.count();
  if (existingBuses === 0) {
    console.log('Seeding routes, buses and recurring departures...');
    let busNo = 1;
    for (const [a, b, km, mins] of ROUTES) {
      for (const [from, to] of [[a, b], [b, a]]) {
        const route = await prisma.busRoute.create({
          data: { originId: cityId[from], destinationId: cityId[to], distanceKm: km, durationMinutes: mins, boardingPoints: POINTS[from], droppingPoints: POINTS[to] },
        });
        const times = mins >= 400 ? DEPARTURES_OVERNIGHT : DEPARTURES_SHORT;
        const count = 4 + Math.floor(rand() * 2); // 4-5 buses per direction
        for (let i = 0; i < count; i++) {
          const kind = BUS_KINDS[(busNo + i) % BUS_KINDS.length];
          const operator = pick(OPERATORS);
          const tmpl = LAYOUT_TEMPLATES[kind.layoutTemplate];
          const bus = await prisma.bus.create({
            data: {
              operatorName: operator,
              registrationNo: `${pick(['KA', 'AP', 'TN', 'TS', 'MH', 'GA', 'DL', 'RJ'])}${String(10 + Math.floor(rand() * 89))}${pick(['A', 'B', 'C', 'D', 'F'])}${String(1000 + busNo).slice(-4)}`,
              serviceCode: `BY${String(busNo).padStart(4, '0')}`,
              acType: kind.acType,
              seatClass: tmpl.seatClass,
              layoutTemplate: kind.layoutTemplate,
              amenities: kind.amenities,
              rating: Math.round((3.6 + rand() * 1.3) * 10) / 10,
              seats: { create: buildLayout(kind.layoutTemplate) },
            },
          });
          busNo++;
          const fareRupees = Math.max(199, Math.round((km * kind.perKm * (0.9 + rand() * 0.3)) / 10) * 10 - 1);
          await prisma.recurringSchedule.create({
            data: { busId: bus.id, routeId: route.id, departureTime: times[i % times.length], baseFare: fareRupees * 100 },
          });
        }
      }
    }
  } else {
    console.log(`${existingBuses} buses already exist - skipping catalogue, topping up schedules only`);
  }

  console.log('Generating schedules for the next 30 days...');
  const created = await generateSchedules({ days: 30 });
  console.log(`  ${created} new schedules`);

  // Pre-sold seats ("sold via other channels") so seat maps look realistic. Only on new schedules without locks.
  console.log('Marking some seats as already sold...');
  const fresh = await prisma.busSchedule.findMany({
    where: { locks: { none: {} }, departureAt: { gt: new Date() } },
    select: { id: true, bus: { select: { seats: { select: { id: true } } } } },
  });
  const locks = [];
  for (const s of fresh) {
    const n = Math.floor(rand() * 14);
    const seats = [...s.bus.seats].sort(() => rand() - 0.5).slice(0, n);
    seats.forEach((seat) => locks.push({ scheduleId: s.id, seatId: seat.id, status: 'BOOKED' }));
  }
  for (let i = 0; i < locks.length; i += 2000) {
    await prisma.seatLock.createMany({ data: locks.slice(i, i + 2000), skipDuplicates: true });
  }
  console.log(`  ${locks.length} seats pre-sold across ${fresh.length} schedules`);
  console.log('Seed complete. Admin login:', adminEmail, '/', process.env.SEED_ADMIN_PASSWORD ? '(SEED_ADMIN_PASSWORD)' : 'Admin@12345');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
