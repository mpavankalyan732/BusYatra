import { config } from '../config/env.js';

/** Fare for a set of seats on a schedule. All values in paise. */
export function computeFare(baseFare, seats) {
  const baseAmount = seats.reduce((sum, s) => sum + baseFare + (s.priceDelta || 0), 0);
  // GST rounded to the nearest whole rupee (amounts are in paise)
  const taxAmount = Math.round((baseAmount * config.booking.taxRate) / 100) * 100;
  const feeAmount = config.booking.convenienceFeePerSeat * seats.length;
  return { baseAmount, taxAmount, feeAmount, totalAmount: baseAmount + taxAmount + feeAmount };
}

export const seatFare = (baseFare, seat) => baseFare + (seat.priceDelta || 0);
