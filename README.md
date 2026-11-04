# BusYatra — bus ticket booking platform

A full-stack, RedBus-style intercity bus booking app: live search, an interactive seat map with server-side seat locking, dynamic passenger forms, a **demo** card/UPI payment gateway, PDF e-tickets with QR codes, email confirmations, Salesforce CRM sync, and an AI rescheduling assistant built for **Salesforce Agentforce** (with a clearly labelled mock when Agentforce isn't configured).

> **Demo project.** Payments are simulated. Only the published test cards / UPI IDs are accepted, and no card number or CVV is ever stored. Tickets are not valid for travel. Bus operators in the seed data are fictional.

| Layer | Tech |
| --- | --- |
| Frontend | React 18 + Vite, Tailwind CSS 4, Framer Motion, React Router, Axios, Lucide icons |
| Backend | Node.js + Express, Prisma ORM, PostgreSQL, JWT, zod validation, pino logging |
| Integrations | Nodemailer (SMTP), PDFKit + QR, Salesforce REST (OAuth client credentials), Agentforce Agent API + Apex actions |
| Deploy | GitHub + Render (Blueprint in `render.yaml`) |

📐 **Architecture, DB schema, API, page flow and integration diagrams:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Features

- **Search** by origin, destination and date (cities from the API). Filters: A/C, sleeper/seater/semi-sleeper, departure time, max price, operator. Sort by price, departure, duration, seats. Paginated.
- **Seat selection** on a realistic layout (seater 2+2, semi-sleeper, 2+1 sleeper with upper/lower decks, driver position). Green = available, blue = selected, grey = booked. Live refresh every 15 s.
- **Seat locking**: seats are held for 10 minutes in PostgreSQL. A `UNIQUE(scheduleId, seatId)` constraint guarantees two customers can never get the same seat — tested with 8 simultaneous requests (exactly one wins).
- **Passengers**: one form per selected seat, plus contact email/mobile, validated client- and server-side.
- **Review** page priced by the server (fare + 5 % GST + convenience fee) with edit buttons.
- **Demo payments**: card and UPI, processing state, failure + retry, idempotency keys, double-submit guard, and a DB-level guarantee of at most one successful payment per booking. A pluggable provider layer (`services/payment/providers`) is ready for a real gateway.
- **Confirmation**: booking IDs like `BUS202611030001`, e-ticket page, downloadable PDF with a QR code pointing to an opaque verification URL, booking history.
- **Email** via an outbox table: queued in the same transaction as the confirmation (so it's never sent for an unconfirmed booking), sent asynchronously with retries.
- **Salesforce**: Contact, `Bus_Booking__c`, `Bus_Passenger__c` upserted by external IDs; failures recorded and retried; bookings never depend on Salesforce being up.
- **Rescheduling**: email OTP proves ownership → chat assistant finds real alternatives, quotes the fare difference + fee (holding seats), and only changes the booking after explicit confirmation — atomically releasing old seats, updating Salesforce and emailing a revised ticket.
- **Admin dashboard** (role-protected): totals, revenue, passengers, status breakdowns, Salesforce sync status, bookings (cancel & refund, retry sync), buses & seat layouts, routes, recurring/one-off schedules.
- Responsive (mobile sticky seat summary, mobile nav), animated stage transitions, toasts, skeletons, reduced-motion support.

## Project structure

```
busyatra/
├── backend/              Express API, Prisma schema + migrations + seed, e2e tests
├── frontend/             React SPA
├── salesforce/           SFDX project: custom objects/fields + Agentforce Apex actions & tests
├── docs/                 ARCHITECTURE, SALESFORCE_SETUP, AGENTFORCE_SETUP, DEPLOYMENT
└── render.yaml           Render Blueprint (Postgres + API + static site)
```

## Run locally

Requirements: Node.js 20+ and PostgreSQL 14+ (local install, Docker, or a free cloud database).

```bash
# 1. Backend
cd backend
cp .env.example .env              # set DATABASE_URL (and JWT_SECRET)
npm install
npx prisma migrate deploy         # create tables
npm run seed                      # 14 cities, 34 routes, ~150 buses, 30 days of trips, demo users
npm run dev                       # http://localhost:4000  (GET /api/health)

# 2. Frontend (new terminal)
cd frontend
npm install
npm run dev                       # http://localhost:5173  (proxies /api to :4000)
```

Docker one-liner for Postgres: `docker run -d --name busyatra-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=busyatra -p 5432:5432 postgres:16`

**Logins (after seeding):** admin `admin@busyatra.dev` / `SEED_ADMIN_PASSWORD` (default `Admin@12345`), user `demo@busyatra.dev` / `Demo@12345`. Booking doesn't require login.

**Test payment instruments**

| Instrument | Result |
| --- | --- |
| `4111 1111 1111 1111` / `5555 5555 5555 4444`, any future expiry, any CVV | Success |
| `4000 0000 0000 0002` | Declined |
| `4000 0000 0000 9995` | Insufficient funds |
| UPI `success@demoupi` | Success |
| UPI `failure@demoupi` | Failure |

**Without SMTP** (default in dev) emails are rendered and logged instead of delivered, and the reschedule OTP is shown on screen (never in production).

## Tests

With the API running against a seeded database:

```bash
cd backend
DEMO_PAYMENT_DELAY_MS=200 npm run dev   # terminal 1 (faster simulated payments)
npm test                                # terminal 2
```

`tests/e2e.test.js` covers the spec scenarios: search (1), single/multi-seat (2, 3), dynamic passenger count (4), card & UPI payment (5, 6), failure + retry + duplicate-payment block (7), booking ID (8), email queued & sent (9), persistence & access control (10), Salesforce sync status (11), OTP + agent reschedule + history + seat release (12–14), and concurrent booking of one seat (15). Apex tests: `sf apex run test --class-names BusYatraRescheduleActionsTest`.

## What needs external credentials

| Feature | Without credentials | To enable |
| --- | --- | --- |
| Email | Rendered to server log | `SMTP_*` — see [DEPLOYMENT.md](docs/DEPLOYMENT.md#10-smtp) |
| Salesforce CRM | Bookings marked `NOT_CONFIGURED` | `SALESFORCE_*` — [SALESFORCE_SETUP.md](docs/SALESFORCE_SETUP.md) |
| Agentforce | Labelled **mock agent** with the same backend actions | `AGENTFORCE_CONFIGURATION` + Named Credential — [AGENTFORCE_SETUP.md](docs/AGENTFORCE_SETUP.md) |
| Real payments | Demo simulator | Implement a provider in `backend/src/services/payment/providers` |

## Deploy

GitHub + Render step-by-step: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
