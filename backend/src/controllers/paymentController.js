import * as paymentService from '../services/payment/paymentService.js';
import { TEST_CARDS, TEST_UPI, verifyUpiHandle } from '../services/payment/providers/demoProvider.js';

const accessTokenOf = (req) => req.headers['x-access-token'] || req.body?.accessToken;
const publicPayment = (p) => ({
  id: p.id,
  bookingId: p.bookingId,
  method: p.method,
  status: p.status,
  amount: p.amount,
  currency: p.currency,
  maskedInstrument: p.maskedInstrument,
  failureReason: p.failureReason,
  providerRef: p.providerRef,
  createdAt: p.createdAt,
});

export async function create(req, res) {
  const p = await paymentService.createPayment({
    bookingId: req.body.bookingId,
    accessToken: accessTokenOf(req),
    method: req.body.method,
    idempotencyKey: req.headers['idempotency-key'],
  });
  res.status(201).json({ success: true, data: publicPayment(p) });
}

export async function verify(req, res) {
  const { paymentId, card, upi } = req.body;
  // card details exist only in this request's memory; they are never persisted or logged
  const p = await paymentService.processPayment({ paymentId, accessToken: accessTokenOf(req), details: card || upi || {} });
  res.json({ success: true, data: publicPayment(p) });
}

export function verifyUpi(req, res) {
  res.json({ success: true, data: verifyUpiHandle(req.body.upiId) });
}

export function testInstruments(_req, res) {
  res.json({
    success: true,
    data: {
      notice: 'DEMO MODE — payments are simulated. Use only these test instruments.',
      cards: Object.entries(TEST_CARDS).map(([number, v]) => ({ number, outcome: v.outcome, label: v.label, expiry: 'any future date', cvv: 'any 3 digits' })),
      upi: Object.entries(TEST_UPI).map(([upiId, v]) => ({ upiId, outcome: v.outcome, label: v.label })),
    },
  });
}
