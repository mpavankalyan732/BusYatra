/**
 * Payment-provider integration layer.
 * To add a real gateway (Razorpay, Stripe, PayU…), implement the same interface:
 *   charge({ method, amount, currency, details, idempotencyKey }) ->
 *     { status: 'SUCCEEDED' | 'FAILED', providerRef, maskedInstrument, failureReason }
 * For redirect / webhook based gateways, `charge` would create the order and a webhook
 * route would call paymentService.markResult(). Select it with PAYMENT_PROVIDER.
 */
import { demoProvider } from './demoProvider.js';

const providers = { demo: demoProvider };

export function getPaymentProvider() {
  const name = process.env.PAYMENT_PROVIDER || 'demo';
  const p = providers[name];
  if (!p) throw new Error(`Unknown PAYMENT_PROVIDER "${name}"`);
  return p;
}
