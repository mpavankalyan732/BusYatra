/**
 * Booking-ownership verification: booking ID + contact email -> 6-digit OTP to that email.
 * Only a hash of the code is stored; 5 attempts max; 10 minute expiry.
 * Responses are identical whether or not the booking exists (no enumeration).
 */
import crypto from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { config, smtpConfigured } from '../../config/env.js';
import { badRequest } from '../../lib/errors.js';
import { sha256 } from '../../lib/util.js';
import { logger } from '../../lib/logger.js';
import { signRescheduleToken } from '../../middleware/auth.js';
import { sendOtpEmail } from '../email/emailService.js';

const OTP_TTL_MS = 10 * 60 * 1000;
const hashCode = (bookingId, code) => sha256(`${bookingId}:${code}:${config.jwtSecret}`);

export async function startVerification({ bookingCode, email }) {
  const generic = { message: 'If the booking ID and email match, a verification code has been sent to that email.' };
  const booking = await prisma.booking.findUnique({ where: { bookingCode: bookingCode.trim().toUpperCase() } });
  if (!booking || booking.contactEmail?.toLowerCase() !== email.trim().toLowerCase()) return generic;

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  await prisma.verificationCode.updateMany({ where: { bookingId: booking.id, consumedAt: null }, data: { consumedAt: new Date() } });
  await prisma.verificationCode.create({ data: { bookingId: booking.id, codeHash: hashCode(booking.id, code), expiresAt: new Date(Date.now() + OTP_TTL_MS) } });

  try {
    await sendOtpEmail(booking.contactEmail, code, booking.bookingCode);
  } catch (err) {
    logger.error({ err: err.message }, 'Failed to send OTP email');
  }
  // DEVELOPMENT ONLY: without SMTP there is no way to receive the code, so expose it.
  if (!smtpConfigured() && !config.isProd) return { ...generic, devOtp: code, devNote: 'SMTP is not configured - OTP shown for local testing only' };
  return generic;
}

export async function completeVerification({ bookingCode, email, otp }) {
  const fail = () => badRequest('Invalid or expired verification code');
  const booking = await prisma.booking.findUnique({ where: { bookingCode: bookingCode.trim().toUpperCase() } });
  if (!booking || booking.contactEmail?.toLowerCase() !== email.trim().toLowerCase()) throw fail();

  const vc = await prisma.verificationCode.findFirst({
    where: { bookingId: booking.id, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (!vc || vc.attempts >= 5) throw fail();
  if (vc.codeHash !== hashCode(booking.id, String(otp).trim())) {
    await prisma.verificationCode.update({ where: { id: vc.id }, data: { attempts: { increment: 1 } } });
    throw fail();
  }
  await prisma.verificationCode.update({ where: { id: vc.id }, data: { consumedAt: new Date() } });
  await prisma.bookingHistory.create({ data: { bookingId: booking.id, action: 'OWNERSHIP_VERIFIED', actor: 'customer', details: { method: 'email_otp' } } });
  return { token: signRescheduleToken(booking.id, booking.bookingCode), bookingId: booking.id, bookingCode: booking.bookingCode, expiresInSeconds: 1800 };
}
