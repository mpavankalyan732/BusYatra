import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { config } from '../../config/env.js';
import { formatInrAscii } from '../../lib/util.js';
import { formatIstDate, formatIstTime } from '../../lib/time.js';
import { serializeBooking } from '../serializers.js';

export const ticketVerifyUrl = (ticketToken) => `${config.frontendUrl}/verify/${ticketToken}`;

const BRAND = '#D7263D';
const INK = '#1F2937';
const MUTED = '#6B7280';

/** Render an e-ticket PDF and resolve with a Buffer. */
export async function generateTicketPdf(bookingRecord) {
  const b = serializeBooking(bookingRecord);
  const s = b.schedule;
  const qrPng = await QRCode.toBuffer(ticketVerifyUrl(bookingRecord.ticketToken || 'pending'), { margin: 1, width: 220 });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40, info: { Title: `BusYatra e-ticket ${b.bookingCode}` } });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width - 80;

    // Header band
    doc.rect(0, 0, doc.page.width, 90).fill(BRAND);
    doc.fillColor('#fff').fontSize(24).font('Helvetica-Bold').text('BusYatra', 40, 28);
    doc.fontSize(10).font('Helvetica').text('e-Ticket  |  Demo booking platform', 40, 58);
    doc.fontSize(10).text(`Booking ID`, 0, 30, { align: 'right', width: doc.page.width - 40 });
    doc.fontSize(16).font('Helvetica-Bold').text(b.bookingCode || '-', 0, 44, { align: 'right', width: doc.page.width - 40 });

    // Journey block
    let y = 115;
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(18)
      .text(`${s.route.origin.name}  ->  ${s.route.destination.name}`, 40, y);
    y += 28;
    doc.font('Helvetica').fontSize(11).fillColor(MUTED)
      .text(`${formatIstDate(s.departureAt)}   |   Status: ${b.status}   |   Payment: ${b.paymentStatus}`, 40, y);

    y += 30;
    const col = (label, value, x, w) => {
      doc.fillColor(MUTED).fontSize(9).font('Helvetica').text(label.toUpperCase(), x, y, { width: w });
      doc.fillColor(INK).fontSize(12).font('Helvetica-Bold').text(value, x, y + 13, { width: w });
    };
    // Left area ends at x=405 so nothing runs under the QR code (x >= 425).
    col('Departure', `${formatIstTime(s.departureAt)}`, 40, 90);
    col('Arrival', `${formatIstTime(s.arrivalAt)} (${formatIstDate(s.arrivalAt)})`, 135, 175);
    col('Duration', `${Math.floor(s.durationMinutes / 60)}h ${s.durationMinutes % 60}m`, 320, 85);
    y += 45;
    col('Operator', s.bus.operatorName, 40, 170);
    col('Bus', `${s.bus.acType === 'AC' ? 'AC' : 'Non-AC'} ${s.bus.seatClass.replace('_', '-').toLowerCase()} - ${s.bus.registrationNo}`, 220, 185);
    y += 45;
    col('Boarding point', s.route.boardingPoints[0] || s.route.origin.name, 40, 170);
    col('Dropping point', s.route.droppingPoints[0] || s.route.destination.name, 220, 185);

    // QR
    doc.image(qrPng, doc.page.width - 40 - 130, 160, { width: 130 });
    doc.fontSize(8).fillColor(MUTED).font('Helvetica').text('Scan to verify ticket', doc.page.width - 40 - 130, 294, { width: 130, align: 'center' });

    // Passengers table
    y += 60;
    doc.moveTo(40, y).lineTo(40 + W, y).strokeColor('#E5E7EB').stroke();
    y += 12;
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(13).text('Passengers', 40, y);
    y += 22;
    const cols = [40, 90, 330, 400];
    ['Seat', 'Name', 'Age', 'Gender'].forEach((h, i) => doc.fontSize(9).fillColor(MUTED).font('Helvetica-Bold').text(h.toUpperCase(), cols[i], y));
    y += 16;
    b.passengers.forEach((p) => {
      doc.fontSize(11).fillColor(INK).font('Helvetica');
      doc.text(p.seatNumber, cols[0], y);
      doc.text(p.name, cols[1], y, { width: 230 });
      doc.text(String(p.age), cols[2], y);
      doc.text(p.gender.charAt(0) + p.gender.slice(1).toLowerCase(), cols[3], y);
      y += 20;
    });

    // Fare
    y += 15;
    doc.moveTo(40, y).lineTo(40 + W, y).strokeColor('#E5E7EB').stroke();
    y += 12;
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(13).text('Fare details', 40, y);
    y += 22;
    const fareRow = (label, val, bold = false) => {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(11).fillColor(INK).text(label, 40, y);
      doc.text(val, 40, y, { width: W, align: 'right' });
      y += 18;
    };
    fareRow(`Base fare (${b.seatCount} seat${b.seatCount > 1 ? 's' : ''})`, formatInrAscii(b.fare.baseAmount));
    fareRow('GST', formatInrAscii(b.fare.taxAmount));
    fareRow(b.rescheduleCount > 0 ? 'Convenience & reschedule fees' : 'Convenience fee', formatInrAscii(b.fare.feeAmount));
    fareRow('Total paid', formatInrAscii(b.fare.totalAmount), true);

    // Footer
    y += 25;
    doc.fontSize(9).fillColor(MUTED).font('Helvetica').text(
      `Contact: ${b.contact.email} / ${b.contact.phone}\n` +
        'Please carry a valid photo ID. Report at the boarding point 15 minutes before departure.\n' +
        'DEMO PROJECT: this ticket was issued by a demonstration application and payment was simulated. It is not valid for travel.',
      40, y, { width: W },
    );
    doc.end();
  });
}
