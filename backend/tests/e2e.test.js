/**
 * End-to-end API tests. Run against a live, seeded API:
 *   API_URL=http://localhost:4000 npm test
 * (Set DEMO_PAYMENT_DELAY_MS=200 on the server to make them quick.)
 * Covers the booking journey, payments, concurrency and the (mock-agent) reschedule flow.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';

const API = (process.env.API_URL || 'http://localhost:4000') + '/api';

async function api(method, path, body, headers = {}) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const ct = res.headers.get('content-type') || '';
  const json = ct.includes('json') ? await res.json() : await res.arrayBuffer();
  return { status: res.status, body: json, headers: res.headers };
}

const tomorrowIst = (offset = 1) => {
  const d = new Date(Date.now() + 330 * 60000 + offset * 864e5);
  return d.toISOString().slice(0, 10);
};

let cities;
let schedule;

before(async () => {
  const r = await api('GET', '/cities');
  assert.equal(r.status, 200);
  cities = Object.fromEntries(r.body.data.map((c) => [c.name, c]));
});

async function availableSeats(scheduleId, n) {
  const r = await api('GET', `/buses/${scheduleId}/seats`);
  return r.body.data.seats.filter((s) => s.status === 'available').slice(0, n);
}

async function bookAndPay({ seats, method = 'CARD', card = '4111111111111111', upi = 'success@demoupi', email = 'traveller@example.com' }) {
  const lock = await api('POST', '/bookings/lock-seats', { scheduleId: schedule.id, seatIds: seats.map((s) => s.id) });
  assert.equal(lock.status, 201, JSON.stringify(lock.body));
  const { id: bookingId, accessToken } = lock.body.data;
  const H = { 'x-access-token': accessToken };
  const pax = await api('POST', '/bookings/passengers', {
    bookingId,
    contact: { email, phone: '9876543210' },
    passengers: seats.map((s, i) => ({ seatId: s.id, name: `Passenger ${String.fromCharCode(65 + i)}`, age: 30 + i, gender: i % 2 ? 'FEMALE' : 'MALE' })),
  }, H);
  assert.equal(pax.status, 200, JSON.stringify(pax.body));
  const pay = await api('POST', '/payments/create', { bookingId, method }, H);
  assert.equal(pay.status, 201, JSON.stringify(pay.body));
  const details = method === 'CARD' ? { card: { cardNumber: card, expiry: '12/30', cvv: '123', name: 'Test User' } } : { upi: { upiId: upi } };
  const ver = await api('POST', '/payments/verify', { paymentId: pay.body.data.id, ...details }, H);
  return { bookingId, accessToken, H, payment: ver.body.data, paxBooking: pax.body.data };
}

test('Scenario 1: search buses Tirupati -> Bangalore', async () => {
  const r = await api('GET', `/buses/search?from=${cities.Tirupati.id}&to=${cities.Bangalore.id}&date=${tomorrowIst()}&sort=price`);
  assert.equal(r.status, 200);
  assert.ok(r.body.data.items.length > 0, 'expected buses');
  const fares = r.body.data.items.map((i) => i.baseFare);
  assert.deepEqual(fares, [...fares].sort((a, b) => a - b), 'sorted by price');
  schedule = r.body.data.items.find((i) => i.availableSeats >= 6);
  assert.ok(schedule);
  const f = await api('GET', `/buses/search?from=tirupati&to=bangalore&date=${tomorrowIst()}&acType=AC`);
  assert.ok(f.body.data.items.every((i) => i.bus.acType === 'AC'), 'AC filter');
});

test('Scenarios 2,4,5,8,10: single seat, dynamic passengers, card payment, booking ID, persisted', async () => {
  const [seat] = await availableSeats(schedule.id, 1);
  const r = await bookAndPay({ seats: [seat] });
  assert.equal(r.payment.status, 'SUCCEEDED');
  assert.ok(!JSON.stringify(r.payment).includes('4111111111111111'), 'full card number never returned');
  const conf = await api('POST', '/bookings/confirm', { bookingId: r.bookingId }, r.H);
  assert.equal(conf.status, 200);
  assert.match(conf.body.data.bookingCode, /^BUS\d{12}$/);
  assert.equal(conf.body.data.status, 'CONFIRMED');
  const again = await api('POST', '/bookings/confirm', { bookingId: r.bookingId }, r.H);
  assert.equal(again.body.data.bookingCode, conf.body.data.bookingCode, 'confirm is idempotent');
  const get = await api('GET', `/bookings/${conf.body.data.bookingCode}?email=traveller@example.com`);
  assert.equal(get.status, 200);
  assert.equal(get.body.data.passengers.length, 1);
  const denied = await api('GET', `/bookings/${conf.body.data.bookingCode}?email=someone@else.com`);
  assert.equal(denied.status, 403);
  const pdf = await api('GET', `/bookings/${conf.body.data.bookingCode}/ticket.pdf`, null, r.H);
  assert.equal(pdf.status, 200);
  assert.equal(Buffer.from(pdf.body).subarray(0, 4).toString(), '%PDF');
  const seats = await api('GET', `/buses/${schedule.id}/seats`);
  assert.equal(seats.body.data.seats.find((s) => s.id === seat.id).status, 'booked');
});

test('Scenarios 3,4,6,9: multiple seats, passenger count enforced, UPI, email queued', async () => {
  const seats = await availableSeats(schedule.id, 3);
  const lock = await api('POST', '/bookings/lock-seats', { scheduleId: schedule.id, seatIds: seats.map((s) => s.id) });
  const H = { 'x-access-token': lock.body.data.accessToken };
  const bad = await api('POST', '/bookings/passengers', {
    bookingId: lock.body.data.id,
    contact: { email: 'multi@example.com', phone: '9876543210' },
    passengers: [{ seatId: seats[0].id, name: 'Only One', age: 30, gender: 'MALE' }],
  }, H);
  assert.equal(bad.status, 400, 'must supply one passenger per seat');
  await api('DELETE', `/bookings/${lock.body.data.id}/hold`, null, H);

  const r = await bookAndPay({ seats, method: 'UPI', email: 'multi@example.com' });
  assert.equal(r.payment.status, 'SUCCEEDED');
  assert.equal(r.paxBooking.fare.totalAmount, r.payment.amount);
  const conf = await api('POST', '/bookings/confirm', { bookingId: r.bookingId }, r.H);
  assert.equal(conf.body.data.passengers.length, 3);
  await new Promise((res) => setTimeout(res, 1500));
  const get = await api('GET', `/bookings/${r.bookingId}`, null, r.H);
  assert.ok(get.body.data.emails.some((e) => e.type === 'BOOKING_CONFIRMATION' && e.status === 'SENT'), JSON.stringify(get.body.data.emails));
});

test('Scenario 7: payment failure then retry succeeds; duplicate payment blocked', async () => {
  const [seat] = await availableSeats(schedule.id, 1);
  const r = await bookAndPay({ seats: [seat], card: '4000000000000002' });
  assert.equal(r.payment.status, 'FAILED');
  const early = await api('POST', '/bookings/confirm', { bookingId: r.bookingId }, r.H);
  assert.equal(early.status, 409, 'cannot confirm without successful payment');
  const retry = await api('POST', '/payments/create', { bookingId: r.bookingId, method: 'CARD' }, r.H);
  const ok = await api('POST', '/payments/verify', { paymentId: retry.body.data.id, card: { cardNumber: '4111 1111 1111 1111', expiry: '12/30', cvv: '123', name: 'T' } }, r.H);
  assert.equal(ok.body.data.status, 'SUCCEEDED');
  const dup = await api('POST', '/payments/create', { bookingId: r.bookingId, method: 'CARD' }, r.H);
  assert.equal(dup.status, 409, 'second payment rejected');
  const conf = await api('POST', '/bookings/confirm', { bookingId: r.bookingId }, r.H);
  assert.equal(conf.body.data.status, 'CONFIRMED');
});

test('Scenario 15: simultaneous booking of the same seat - exactly one wins', async () => {
  const [seat] = await availableSeats(schedule.id, 1);
  const attempts = await Promise.all(
    Array.from({ length: 8 }, () => api('POST', '/bookings/lock-seats', { scheduleId: schedule.id, seatIds: [seat.id] })),
  );
  const won = attempts.filter((a) => a.status === 201);
  const lost = attempts.filter((a) => a.status === 409);
  assert.equal(won.length, 1, `exactly one lock expected, got ${attempts.map((a) => a.status)}`);
  assert.equal(lost.length, 7);
  assert.equal(lost[0].body.error.code, 'SEATS_UNAVAILABLE');
});

test('Scenarios 12-14: verify ownership, mock agent reschedule, history updated', async () => {
  const seats = await availableSeats(schedule.id, 2);
  const r = await bookAndPay({ seats, email: 'resched@example.com' });
  const conf = await api('POST', '/bookings/confirm', { bookingId: r.bookingId }, r.H);
  const code = conf.body.data.bookingCode;

  const wrong = await api('POST', '/reschedule/verify/complete', { bookingCode: code, email: 'resched@example.com', otp: '000000' });
  assert.equal(wrong.status, 400);
  const start = await api('POST', '/reschedule/verify/start', { bookingCode: code, email: 'resched@example.com' });
  assert.ok(start.body.data.devOtp, 'dev OTP exposed only without SMTP');
  const done = await api('POST', '/reschedule/verify/complete', { bookingCode: code, email: 'resched@example.com', otp: start.body.data.devOtp });
  assert.equal(done.status, 200);
  const RH = { 'x-reschedule-token': done.body.data.token };

  const sess = await api('POST', '/reschedule/agent/sessions', {}, RH);
  assert.equal(sess.status, 201, JSON.stringify(sess.body));
  assert.equal(sess.body.data.provider.isMock, true);
  assert.match(sess.body.data.messages[0].text, /found your booking/);
  const sid = sess.body.data.sessionId;
  const say = (text) => api('POST', `/reschedule/agent/sessions/${sid}/messages`, { text }, RH);

  const alt = await say('I want to travel the day after tomorrow instead');
  const altMsg = alt.body.data.messages[0];
  assert.equal(altMsg.data?.type, 'alternatives', altMsg.text);
  assert.ok(altMsg.data.items.every((i) => i.availableSeats >= 2));
  const q = await say('1');
  assert.equal(q.body.data.messages[0].data?.type, 'quote', q.body.data.messages[0].text);
  const confirm = await say('yes');
  assert.equal(confirm.body.data.messages[0].data?.type, 'done', confirm.body.data.messages[0].text);

  const after = await api('GET', `/bookings/${code}`, null, r.H);
  assert.equal(after.body.data.rescheduleCount, 1);
  assert.equal(after.body.data.schedule.journeyDate, tomorrowIst(2));
  assert.ok(after.body.data.history.some((h) => h.action === 'RESCHEDULED'));
  const oldSeats = await api('GET', `/buses/${schedule.id}/seats`);
  for (const s of seats) assert.equal(oldSeats.body.data.seats.find((x) => x.id === s.id).status, 'available', 'old seats released');

  // REST reschedule API refuses changes without explicit confirmation
  const noConfirm = await api('POST', `/bookings/${code}/reschedule/abc/confirm`, { customerConfirmed: false }, RH);
  assert.equal(noConfirm.status, 400);
});

test('Agentforce action endpoints require API key and customer verification', async () => {
  const noKey = await api('POST', '/agent-actions/get-booking', { verificationToken: 'x'.repeat(30) });
  assert.equal(noKey.status, 401);
});

test('Scenario 11: Salesforce sync status is tracked (not configured locally)', async () => {
  const h = await api('GET', '/health');
  assert.ok(h.body.data.integrations.salesforce);
});

test('Admin endpoints are protected and work for admins', async () => {
  const anon = await api('GET', '/admin/stats');
  assert.equal(anon.status, 401);
  const login = await api('POST', '/auth/login', { email: 'admin@busyatra.dev', password: process.env.SEED_ADMIN_PASSWORD || 'Admin@12345' });
  assert.equal(login.status, 200);
  const stats = await api('GET', '/admin/stats', null, { Authorization: `Bearer ${login.body.data.token}` });
  assert.equal(stats.status, 200);
  assert.ok(stats.body.data.totals.confirmed >= 3);
  const user = await api('POST', '/auth/login', { email: 'demo@busyatra.dev', password: 'Demo@12345' });
  const forbidden = await api('GET', '/admin/stats', null, { Authorization: `Bearer ${user.body.data.token}` });
  assert.equal(forbidden.status, 403);
});
