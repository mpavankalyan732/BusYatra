/**
 * DEMO PAYMENT PROVIDER — SIMULATION ONLY.
 *
 * No money moves and nothing is sent to any bank or network. Only the published
 * test instruments below are accepted, which also stops users from typing real
 * card numbers into a demo. Card numbers / CVV are validated in memory and then
 * discarded; only a masked "•••• 1111" and a fake provider token are persisted.
 */
import crypto from 'node:crypto';

export const TEST_CARDS = {
  '4111111111111111': { outcome: 'SUCCEEDED', label: 'Visa test card — success' },
  '5555555555554444': { outcome: 'SUCCEEDED', label: 'Mastercard test card — success' },
  '4000000000000002': { outcome: 'FAILED', label: 'Declined by issuer', reason: 'Card declined by issuer (test scenario)' },
  '4000000000009995': { outcome: 'FAILED', label: 'Insufficient funds', reason: 'Insufficient funds (test scenario)' },
};

export const TEST_UPI = {
  'success@demoupi': { outcome: 'SUCCEEDED', label: 'UPI success', name: 'Demo Customer' },
  'failure@demoupi': { outcome: 'FAILED', label: 'UPI failure', name: 'Demo Customer', reason: 'UPI collect request declined (test scenario)' },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function luhn(num) {
  let sum = 0;
  let dbl = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let d = Number(num[i]);
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

const brandOf = (n) => (n.startsWith('4') ? 'VISA' : n.startsWith('5') ? 'MASTERCARD' : 'CARD');

export function verifyUpiHandle(upiId) {
  const id = String(upiId || '').trim().toLowerCase();
  const t = TEST_UPI[id];
  return t ? { valid: true, name: t.name, upiId: id } : { valid: false, upiId: id };
}

export const demoProvider = {
  name: 'demo',

  /** Returns { status, providerRef, maskedInstrument, failureReason } */
  async charge({ method, amount, details }) {
    await sleep(Number(process.env.DEMO_PAYMENT_DELAY_MS ?? 1200)); // simulate network/bank latency
    const providerRef = `demo_pay_${crypto.randomBytes(8).toString('hex')}`;

    if (method === 'CARD') {
      const number = String(details.cardNumber || '').replace(/\s+/g, '');
      const [mm, yy] = String(details.expiry || '').split('/').map((x) => Number(x));
      const masked = `${brandOf(number)} •••• ${number.slice(-4)}`;
      if (!/^\d{16}$/.test(number) || !luhn(number)) return { status: 'FAILED', providerRef, maskedInstrument: masked, failureReason: 'Invalid card number' };
      if (!mm || mm > 12 || !yy || new Date(2000 + yy, mm, 1) <= new Date()) return { status: 'FAILED', providerRef, maskedInstrument: masked, failureReason: 'Card expired or invalid expiry' };
      if (!/^\d{3,4}$/.test(String(details.cvv || ''))) return { status: 'FAILED', providerRef, maskedInstrument: masked, failureReason: 'Invalid CVV' };
      const test = TEST_CARDS[number];
      if (!test) return { status: 'FAILED', providerRef, maskedInstrument: masked, failureReason: 'Demo mode accepts only the listed test cards' };
      return { status: test.outcome, providerRef, maskedInstrument: masked, failureReason: test.reason || null, amount };
    }

    if (method === 'UPI') {
      const v = verifyUpiHandle(details.upiId);
      const test = TEST_UPI[v.upiId];
      if (!test) return { status: 'FAILED', providerRef, maskedInstrument: v.upiId, failureReason: 'Demo mode accepts only the listed test UPI IDs' };
      return { status: test.outcome, providerRef, maskedInstrument: `UPI ${v.upiId}`, failureReason: test.reason || null, amount };
    }

    return { status: 'FAILED', providerRef, failureReason: 'Unsupported payment method' };
  },
};
