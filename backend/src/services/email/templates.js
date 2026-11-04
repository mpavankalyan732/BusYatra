import { formatInr } from '../../lib/util.js';
import { formatIstDate, formatIstTime } from '../../lib/time.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function layout(title, bodyHtml) {
  return `<!doctype html><html><body style="margin:0;background:#f4f4f7;font-family:Segoe UI,Arial,sans-serif;color:#1f2937">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden">
    <tr><td style="background:#D7263D;color:#fff;padding:20px 28px;font-size:22px;font-weight:700">BusYatra</td></tr>
    <tr><td style="padding:28px"><h2 style="margin:0 0 16px;font-size:20px">${esc(title)}</h2>${bodyHtml}</td></tr>
    <tr><td style="padding:16px 28px;background:#f9fafb;color:#6b7280;font-size:12px">
      This is a demo application. Payments are simulated and tickets are not valid for travel.</td></tr>
  </table></td></tr></table></body></html>`;
}

function tripTable(b) {
  const s = b.schedule;
  const rows = [
    ['Booking ID', `<b>${esc(b.bookingCode)}</b>`],
    ['Route', `${esc(s.route.origin.name)} &rarr; ${esc(s.route.destination.name)}`],
    ['Journey date', esc(formatIstDate(s.departureAt))],
    ['Departure', esc(formatIstTime(s.departureAt))],
    ['Arrival', `${esc(formatIstTime(s.arrivalAt))} (${esc(formatIstDate(s.arrivalAt))})`],
    ['Bus', `${esc(s.bus.operatorName)} &middot; ${esc(s.bus.registrationNo)}`],
    ['Bus operator', esc(s.bus.operatorName)],
    ['Bus ID', esc(s.bus.serviceCode || s.bus.id)],
    ['Booking status', esc(b.status.charAt(0) + b.status.slice(1).toLowerCase())],
    ['Payment status', esc(b.paymentStatus.charAt(0) + b.paymentStatus.slice(1).toLowerCase())],
    ['Contact', `${esc(b.contact.email)} &middot; ${esc(b.contact.phone)}`],
    ['Boarding', esc(s.route.boardingPoints[0] || s.route.origin.name)],
    ['Seats', esc(b.seatNumbers.join(', '))],
    ['Fare', `Base ${esc(formatInr(b.fare.baseAmount))} + tax ${esc(formatInr(b.fare.taxAmount))} + fee ${esc(formatInr(b.fare.feeAmount))}`],
    ['Total fare', `<b>${esc(formatInr(b.fare.totalAmount))}</b>`],
  ];
  const pax = b.passengers.map((p) => `<li>${esc(p.name)} (${p.age}, ${esc(p.gender.toLowerCase())}) &mdash; seat ${esc(p.seatNumber)}</li>`).join('');
  return `<table cellpadding="6" style="border-collapse:collapse;width:100%;font-size:14px">
    ${rows.map(([k, v]) => `<tr><td style="color:#6b7280;width:140px;vertical-align:top">${k}</td><td>${v}</td></tr>`).join('')}
  </table>
  <h3 style="font-size:15px;margin:20px 0 8px">Passengers</h3><ul style="padding-left:18px;margin:0;font-size:14px">${pax}</ul>`;
}

function textVersion(title, b) {
  const s = b.schedule;
  return `${title}\n\nBooking ID: ${b.bookingCode}\nRoute: ${s.route.origin.name} -> ${s.route.destination.name}\n` +
    `Journey: ${formatIstDate(s.departureAt)} ${formatIstTime(s.departureAt)} - ${formatIstTime(s.arrivalAt)}\n` +
    `Seats: ${b.seatNumbers.join(', ')}\nBus: ${s.bus.operatorName} (${s.bus.registrationNo})
Status: ${b.status} / payment ${b.paymentStatus}
Passengers: ${b.passengers.map((p) => `${p.name} (seat ${p.seatNumber})`).join(', ')}\nTotal: ${formatInr(b.fare.totalAmount)}\n`;
}

export function bookingConfirmationEmail(b, verifyUrl) {
  const title = 'Your bus ticket is confirmed';
  return {
    html: layout(title, `<p>Hi ${esc(b.contact.name)}, thanks for booking with BusYatra. Your e-ticket is attached.</p>${tripTable(b)}
      <p style="margin-top:20px"><a href="${esc(verifyUrl)}" style="color:#D7263D">Verify / view ticket online</a></p>`),
    text: textVersion(title, b),
  };
}

export function rescheduleConfirmationEmail(b, verifyUrl, change) {
  const title = 'Your booking has been rescheduled';
  const note = change
    ? `<p style="background:#fef3c7;padding:10px 12px;border-radius:8px;font-size:14px">Previous journey: ${esc(change.from)}.<br/>
       ${change.netPayable >= 0 ? `Amount charged: ${esc(formatInr(change.netPayable))}` : `Refund: ${esc(formatInr(-change.netPayable))}`} (incl. reschedule fee ${esc(formatInr(change.fee))}).</p>`
    : '';
  return {
    html: layout(title, `<p>Hi ${esc(b.contact.name)}, your booking was changed as you requested. Your revised e-ticket is attached.</p>${note}${tripTable(b)}
      <p style="margin-top:20px"><a href="${esc(verifyUrl)}" style="color:#D7263D">Verify / view ticket online</a></p>`),
    text: textVersion(title, b),
  };
}

export function cancellationEmail(b) {
  const title = 'Your booking has been cancelled';
  return { html: layout(title, `<p>Booking <b>${esc(b.bookingCode)}</b> has been cancelled. Any refund due has been initiated (demo).</p>${tripTable(b)}`), text: textVersion(title, b) };
}

export function otpEmail(code, bookingCode) {
  return {
    subject: `Your BusYatra verification code: ${code}`,
    html: layout('Verify your booking', `<p>Use this code to manage booking <b>${esc(bookingCode)}</b>. It expires in 10 minutes.</p>
      <p style="font-size:32px;letter-spacing:8px;font-weight:700">${esc(code)}</p><p style="color:#6b7280;font-size:13px">If you didn't request this, ignore this email.</p>`),
    text: `Your BusYatra verification code for ${bookingCode} is ${code}. It expires in 10 minutes.`,
  };
}
