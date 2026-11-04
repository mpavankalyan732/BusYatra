/**
 * Transactional email with an outbox table (EmailNotification) and retries.
 * Emails are enqueued INSIDE the booking transaction, so a confirmation email
 * exists if and only if the booking was confirmed. A worker sends them afterwards.
 */
import nodemailer from 'nodemailer';
import { prisma } from '../../lib/prisma.js';
import { config, smtpConfigured } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { bookingInclude, serializeBooking } from '../serializers.js';
import { generateTicketPdf, ticketVerifyUrl } from '../ticket/pdfService.js';
import { bookingConfirmationEmail, cancellationEmail, otpEmail, rescheduleConfirmationEmail } from './templates.js';

const MAX_ATTEMPTS = 5;

let transporter;
function getTransport() {
  if (transporter) return transporter;
  transporter = smtpConfigured()
    ? nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.port === 465,
        auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
      })
    : // Development fallback: render the message but don't deliver it.
      nodemailer.createTransport({ jsonTransport: true });
  return transporter;
}

export const transportName = () => (smtpConfigured() ? 'smtp' : 'dev-log (SMTP not configured)');

async function deliver(message) {
  const info = await getTransport().sendMail({ from: config.smtp.from, ...message });
  if (!smtpConfigured()) {
    logger.info({ to: message.to, subject: message.subject, attachments: (message.attachments || []).map((a) => a.filename) },
      '[email:dev] SMTP not configured - email rendered but NOT delivered');
  }
  return info;
}

export function enqueueEmail(tx, { bookingId, type, toEmail, subject }) {
  return tx.emailNotification.create({ data: { bookingId, type, toEmail, subject } });
}

async function buildMessage(n) {
  const record = await prisma.booking.findUnique({ where: { id: n.bookingId }, include: bookingInclude });
  const b = serializeBooking(record);
  const verifyUrl = ticketVerifyUrl(record.ticketToken);
  let content;
  let attachTicket = true;
  if (n.type === 'BOOKING_CONFIRMATION') content = bookingConfirmationEmail(b, verifyUrl);
  else if (n.type === 'RESCHEDULE_CONFIRMATION') {
    const last = await prisma.bookingHistory.findFirst({ where: { bookingId: n.bookingId, action: 'RESCHEDULED' }, orderBy: { createdAt: 'desc' } });
    content = rescheduleConfirmationEmail(b, verifyUrl, last?.details);
  } else if (n.type === 'CANCELLATION') {
    content = cancellationEmail(b);
    attachTicket = false;
  } else throw new Error(`Unknown email type ${n.type}`);

  const attachments = attachTicket
    ? [{ filename: `BusYatra-${record.bookingCode}.pdf`, content: await generateTicketPdf(record), contentType: 'application/pdf' }]
    : [];
  return { to: n.toEmail, subject: n.subject, html: content.html, text: content.text, attachments };
}

/** Send one queued notification, recording success or scheduling a retry (exponential backoff). */
export async function processNotification(id) {
  // Claim it so two workers never send the same email.
  const claimed = await prisma.emailNotification.updateMany({
    where: { id, status: 'PENDING', nextAttemptAt: { lte: new Date() } },
    data: { nextAttemptAt: new Date(Date.now() + 5 * 60 * 1000) },
  });
  if (!claimed.count) return;
  const n = await prisma.emailNotification.findUnique({ where: { id } });
  try {
    await deliver(await buildMessage(n));
    await prisma.emailNotification.update({ where: { id }, data: { status: 'SENT', sentAt: new Date(), attempts: n.attempts + 1, transport: transportName(), lastError: null } });
  } catch (err) {
    const attempts = n.attempts + 1;
    const final = attempts >= MAX_ATTEMPTS;
    await prisma.emailNotification.update({
      where: { id },
      data: {
        attempts,
        status: final ? 'FAILED' : 'PENDING',
        lastError: String(err.message || err).slice(0, 500),
        nextAttemptAt: new Date(Date.now() + 2 ** attempts * 60 * 1000),
      },
    });
    logger.warn({ id, attempts, err: err.message }, final ? 'Email permanently failed' : 'Email failed - will retry');
  }
}

export async function processDueEmails(limit = 20) {
  const due = await prisma.emailNotification.findMany({
    where: { status: 'PENDING', nextAttemptAt: { lte: new Date() } },
    orderBy: { createdAt: 'asc' },
    take: limit,
    select: { id: true },
  });
  for (const { id } of due) await processNotification(id);
  return due.length;
}

/** Fire-and-forget immediate processing after a commit. */
export function kickEmailQueue() {
  setImmediate(() => processDueEmails().catch((err) => logger.error({ err }, 'Email queue error')));
}

/** OTPs are sent synchronously (not persisted in the outbox, so the code is never stored in plain text). */
export async function sendOtpEmail(to, code, bookingCode) {
  const m = otpEmail(code, bookingCode);
  await deliver({ to, subject: m.subject, html: m.html, text: m.text });
}
