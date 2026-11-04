/**
 * PostgreSQL -> Salesforce synchronisation.
 *
 * PostgreSQL is the source of truth. Sync runs asynchronously after a booking is
 * confirmed / rescheduled / cancelled. All writes are UPSERTS keyed on external IDs,
 * so a retry can never create duplicate records:
 *   Contact.BusApp_Customer_Key__c   = lower-cased contact email
 *   Bus_Booking__c.Booking_ID__c     = booking code (BUS2026...)
 *   Bus_Passenger__c.Passenger_Key__c = passenger id (stable across reschedules)
 * Failures are recorded on the booking (sfSyncStatus / sfLastError) and retried with backoff.
 */
import { prisma } from '../../lib/prisma.js';
import { salesforceConfigured } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { toIstDateString, istHHmm } from '../../lib/time.js';
import { bookingInclude, serializeBooking } from '../serializers.js';
import { upsertByExternalId } from './salesforceClient.js';

const MAX_ATTEMPTS = 8;

function splitName(full = '') {
  const parts = full.trim().split(/\s+/);
  return parts.length > 1 ? { FirstName: parts.slice(0, -1).join(' '), LastName: parts.at(-1) } : { LastName: parts[0] || 'Customer' };
}

const legacyStatus = (status, rescheduleCount) =>
  status === 'CANCELLED' ? 'Cancelled' : rescheduleCount > 0 ? 'Rescheduled' : 'Confirmed';

export function buildSalesforcePayloads(record) {
  const b = serializeBooking(record);
  const s = b.schedule;
  const customerKey = record.contactEmail.toLowerCase();
  return {
    customerKey,
    contact: { ...splitName(record.contactName), Email: record.contactEmail, MobilePhone: record.contactPhone },
    booking: {
      Customer__r: { BusApp_Customer_Key__c: customerKey },
      Origin_City__c: s.route.origin.name,
      Destination_City__c: s.route.destination.name,
      Journey_Date__c: toIstDateString(s.departureAt),
      Bus_Name__c: `${s.bus.operatorName} (${s.bus.registrationNo})`,
      Departure_Time__c: istHHmm(s.departureAt), // Text(10) in Salesforce, IST "HH:mm"
      Arrival_Time__c: new Date(s.arrivalAt).toISOString(),
      Seat_Numbers__c: b.seatNumbers.join(', '),
      Passenger_Count__c: b.passengers.length,
      Total_Amount__c: b.fare.totalAmount / 100,
      Payment_Status__c: b.paymentStatus,
      Booking_Status__c: b.status,
      Reschedule_Count__c: record.rescheduleCount,
      // Original Bus Booking fields (schema that pre-dates the sync). Types verified against the org:
      // Status__c is a restricted picklist (Confirmed|Rescheduled|Cancelled); Seat_Number__c is Text(10).
      Passenger_Name__c: String(record.contactName).slice(0, 100),
      Passenger_Email__c: record.contactEmail,
      Passenger_Phone__c: record.contactPhone,
      Route__c: `${s.route.origin.name} to ${s.route.destination.name}`.slice(0, 150),
      Travel_Date__c: toIstDateString(s.departureAt),
      Seat_Number__c: b.seatNumbers.join(',').slice(0, 10),
      Status__c: legacyStatus(b.status, record.rescheduleCount),
      Fare__c: b.fare.totalAmount / 100,
      Provider_Booking_Id__c: record.bookingCode,
    },
    passengers: b.passengers.map((p) => ({
      key: p.id,
      record: {
        Name: `${p.name} - ${p.seatNumber}`.slice(0, 80),
        Passenger_Name__c: p.name,
        Age__c: p.age,
        Gender__c: p.gender,
        Seat_Number__c: p.seatNumber,
        Passenger_Email__c: record.contactEmail,
        Passenger_Phone__c: record.contactPhone,
        Bus_ID__c: s.bus.id,
        Bus_Name__c: `${s.bus.operatorName} (${s.bus.registrationNo})`.slice(0, 160),
        Travel_Date__c: toIstDateString(s.departureAt),
        Booking__r: { Booking_ID__c: record.bookingCode },
      },
    })),
  };
}

export async function syncBooking(bookingId) {
  const record = await prisma.booking.findUnique({ where: { id: bookingId }, include: bookingInclude });
  if (!record || !record.bookingCode) return { skipped: true };
  if (!salesforceConfigured()) {
    await prisma.booking.update({ where: { id: bookingId }, data: { sfSyncStatus: 'NOT_CONFIGURED', sfNextAttemptAt: null } });
    return { status: 'NOT_CONFIGURED' };
  }

  const p = buildSalesforcePayloads(record);
  try {
    await upsertByExternalId('Contact', 'BusApp_Customer_Key__c', p.customerKey, p.contact);
    const res = await upsertByExternalId('Bus_Booking__c', 'Booking_ID__c', record.bookingCode, p.booking);
    for (const px of p.passengers) {
      await upsertByExternalId('Bus_Passenger__c', 'Passenger_Key__c', px.key, px.record);
    }
    await prisma.booking.update({
      where: { id: bookingId },
      data: { sfSyncStatus: 'SYNCED', sfSyncedAt: new Date(), sfLastError: null, sfNextAttemptAt: null, sfRecordId: res?.id || record.sfRecordId, sfSyncAttempts: { increment: 1 } },
    });
    await prisma.bookingHistory.create({ data: { bookingId, action: 'SALESFORCE_SYNCED', actor: 'system', details: { recordId: res?.id || record.sfRecordId } } });
    logger.info({ bookingCode: record.bookingCode }, 'Booking synchronised to Salesforce');
    return { status: 'SYNCED' };
  } catch (err) {
    const attempts = record.sfSyncAttempts + 1;
    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        sfSyncStatus: 'FAILED',
        sfSyncAttempts: attempts,
        sfLastError: String(err.message).slice(0, 1000),
        sfNextAttemptAt: attempts >= MAX_ATTEMPTS ? null : new Date(Date.now() + Math.min(2 ** attempts, 360) * 60 * 1000),
      },
    });
    logger.warn({ bookingCode: record.bookingCode, attempts, err: err.message }, 'Salesforce sync failed');
    return { status: 'FAILED', error: err.message };
  }
}

export function kickSalesforceSync(bookingId) {
  setImmediate(() => syncBooking(bookingId).catch((err) => logger.error({ err }, 'Salesforce sync crashed')));
}

/** Retry job: bookings that are pending or failed and due for another attempt. */
export async function retryDueSyncs(limit = 10) {
  if (!salesforceConfigured()) return 0;
  const due = await prisma.booking.findMany({
    where: {
      bookingCode: { not: null },
      sfSyncStatus: { in: ['PENDING', 'FAILED'] },
      sfNextAttemptAt: { lte: new Date() },
      sfSyncAttempts: { lt: MAX_ATTEMPTS },
    },
    select: { id: true },
    take: limit,
  });
  for (const { id } of due) await syncBooking(id);
  return due.length;
}
