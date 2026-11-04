-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "public"."AcType" AS ENUM ('AC', 'NON_AC');

-- CreateEnum
CREATE TYPE "public"."SeatClass" AS ENUM ('SEATER', 'SEMI_SLEEPER', 'SLEEPER');

-- CreateEnum
CREATE TYPE "public"."SeatKind" AS ENUM ('SEATER', 'SLEEPER');

-- CreateEnum
CREATE TYPE "public"."Deck" AS ENUM ('LOWER', 'UPPER');

-- CreateEnum
CREATE TYPE "public"."Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."ScheduleStatus" AS ENUM ('SCHEDULED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."LockStatus" AS ENUM ('HELD', 'BOOKED');

-- CreateEnum
CREATE TYPE "public"."BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "public"."PaymentStatus" AS ENUM ('CREATED', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "public"."PaymentMethod" AS ENUM ('CARD', 'UPI', 'SYSTEM');

-- CreateEnum
CREATE TYPE "public"."PaymentKind" AS ENUM ('BOOKING', 'ADJUSTMENT', 'REFUND');

-- CreateEnum
CREATE TYPE "public"."SyncStatus" AS ENUM ('PENDING', 'SYNCED', 'FAILED', 'NOT_CONFIGURED');

-- CreateEnum
CREATE TYPE "public"."EmailStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."RescheduleStatus" AS ENUM ('QUOTED', 'COMPLETED', 'CANCELLED', 'EXPIRED');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "public"."Role" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."City" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Bus" (
    "id" TEXT NOT NULL,
    "operatorName" TEXT NOT NULL,
    "registrationNo" TEXT NOT NULL,
    "serviceCode" TEXT NOT NULL,
    "acType" "public"."AcType" NOT NULL,
    "seatClass" "public"."SeatClass" NOT NULL,
    "layoutTemplate" TEXT NOT NULL,
    "amenities" TEXT[],
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 4.2,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BusSeat" (
    "id" TEXT NOT NULL,
    "busId" TEXT NOT NULL,
    "seatNumber" TEXT NOT NULL,
    "deck" "public"."Deck" NOT NULL DEFAULT 'LOWER',
    "row" INTEGER NOT NULL,
    "col" INTEGER NOT NULL,
    "kind" "public"."SeatKind" NOT NULL,
    "priceDelta" INTEGER NOT NULL DEFAULT 0,
    "isWindow" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "BusSeat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BusRoute" (
    "id" TEXT NOT NULL,
    "originId" INTEGER NOT NULL,
    "destinationId" INTEGER NOT NULL,
    "distanceKm" INTEGER NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "boardingPoints" TEXT[],
    "droppingPoints" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "BusRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RecurringSchedule" (
    "id" TEXT NOT NULL,
    "busId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "departureTime" TEXT NOT NULL,
    "baseFare" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecurringSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BusSchedule" (
    "id" TEXT NOT NULL,
    "busId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "departureAt" TIMESTAMP(3) NOT NULL,
    "arrivalAt" TIMESTAMP(3) NOT NULL,
    "baseFare" INTEGER NOT NULL,
    "status" "public"."ScheduleStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SeatLock" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "seatId" TEXT NOT NULL,
    "bookingId" TEXT,
    "rescheduleRequestId" TEXT,
    "status" "public"."LockStatus" NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeatLock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Booking" (
    "id" TEXT NOT NULL,
    "bookingCode" TEXT,
    "accessToken" TEXT NOT NULL,
    "ticketToken" TEXT,
    "userId" TEXT,
    "scheduleId" TEXT NOT NULL,
    "status" "public"."BookingStatus" NOT NULL DEFAULT 'PENDING',
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "seatCount" INTEGER NOT NULL,
    "baseAmount" INTEGER NOT NULL DEFAULT 0,
    "taxAmount" INTEGER NOT NULL DEFAULT 0,
    "feeAmount" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" INTEGER NOT NULL DEFAULT 0,
    "lockExpiresAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "rescheduleCount" INTEGER NOT NULL DEFAULT 0,
    "sfSyncStatus" "public"."SyncStatus" NOT NULL DEFAULT 'PENDING',
    "sfSyncAttempts" INTEGER NOT NULL DEFAULT 0,
    "sfNextAttemptAt" TIMESTAMP(3),
    "sfLastError" TEXT,
    "sfRecordId" TEXT,
    "sfSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Passenger" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "seatId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "gender" "public"."Gender" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Passenger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Payment" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "kind" "public"."PaymentKind" NOT NULL DEFAULT 'BOOKING',
    "method" "public"."PaymentMethod" NOT NULL,
    "status" "public"."PaymentStatus" NOT NULL DEFAULT 'CREATED',
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "idempotencyKey" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'demo',
    "providerRef" TEXT,
    "maskedInstrument" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BookingHistory" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RescheduleRequest" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "oldScheduleId" TEXT NOT NULL,
    "newScheduleId" TEXT NOT NULL,
    "newSeatIds" TEXT[],
    "newBaseAmount" INTEGER NOT NULL,
    "newTaxAmount" INTEGER NOT NULL,
    "newFeeAmount" INTEGER NOT NULL,
    "newTotalAmount" INTEGER NOT NULL,
    "fareDifference" INTEGER NOT NULL,
    "rescheduleFee" INTEGER NOT NULL,
    "netPayable" INTEGER NOT NULL,
    "status" "public"."RescheduleStatus" NOT NULL DEFAULT 'QUOTED',
    "channel" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RescheduleRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EmailNotification" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT,
    "type" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "public"."EmailStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "transport" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VerificationCode" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AgentSession" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerSessionId" TEXT,
    "sequenceId" INTEGER NOT NULL DEFAULT 0,
    "state" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DailyCounter" (
    "day" TEXT NOT NULL,
    "value" INTEGER NOT NULL,

    CONSTRAINT "DailyCounter_pkey" PRIMARY KEY ("day")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "City_name_key" ON "public"."City"("name");

-- CreateIndex
CREATE UNIQUE INDEX "City_slug_key" ON "public"."City"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Bus_registrationNo_key" ON "public"."Bus"("registrationNo");

-- CreateIndex
CREATE UNIQUE INDEX "Bus_serviceCode_key" ON "public"."Bus"("serviceCode");

-- CreateIndex
CREATE INDEX "Bus_operatorName_idx" ON "public"."Bus"("operatorName");

-- CreateIndex
CREATE INDEX "BusSeat_busId_idx" ON "public"."BusSeat"("busId");

-- CreateIndex
CREATE UNIQUE INDEX "BusSeat_busId_seatNumber_key" ON "public"."BusSeat"("busId", "seatNumber");

-- CreateIndex
CREATE UNIQUE INDEX "BusRoute_originId_destinationId_key" ON "public"."BusRoute"("originId", "destinationId");

-- CreateIndex
CREATE UNIQUE INDEX "RecurringSchedule_busId_routeId_departureTime_key" ON "public"."RecurringSchedule"("busId", "routeId", "departureTime");

-- CreateIndex
CREATE INDEX "BusSchedule_routeId_departureAt_idx" ON "public"."BusSchedule"("routeId", "departureAt");

-- CreateIndex
CREATE UNIQUE INDEX "BusSchedule_busId_departureAt_key" ON "public"."BusSchedule"("busId", "departureAt");

-- CreateIndex
CREATE INDEX "SeatLock_bookingId_idx" ON "public"."SeatLock"("bookingId");

-- CreateIndex
CREATE INDEX "SeatLock_status_expiresAt_idx" ON "public"."SeatLock"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "SeatLock_scheduleId_seatId_key" ON "public"."SeatLock"("scheduleId", "seatId");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_bookingCode_key" ON "public"."Booking"("bookingCode");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_accessToken_key" ON "public"."Booking"("accessToken");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_ticketToken_key" ON "public"."Booking"("ticketToken");

-- CreateIndex
CREATE INDEX "Booking_status_idx" ON "public"."Booking"("status");

-- CreateIndex
CREATE INDEX "Booking_contactEmail_idx" ON "public"."Booking"("contactEmail");

-- CreateIndex
CREATE INDEX "Booking_userId_idx" ON "public"."Booking"("userId");

-- CreateIndex
CREATE INDEX "Booking_sfSyncStatus_sfNextAttemptAt_idx" ON "public"."Booking"("sfSyncStatus", "sfNextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "Passenger_bookingId_seatId_key" ON "public"."Passenger"("bookingId", "seatId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "public"."Payment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Payment_bookingId_idx" ON "public"."Payment"("bookingId");

-- CreateIndex
CREATE INDEX "BookingHistory_bookingId_idx" ON "public"."BookingHistory"("bookingId");

-- CreateIndex
CREATE INDEX "RescheduleRequest_bookingId_status_idx" ON "public"."RescheduleRequest"("bookingId", "status");

-- CreateIndex
CREATE INDEX "EmailNotification_status_nextAttemptAt_idx" ON "public"."EmailNotification"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "VerificationCode_bookingId_idx" ON "public"."VerificationCode"("bookingId");

-- AddForeignKey
ALTER TABLE "public"."BusSeat" ADD CONSTRAINT "BusSeat_busId_fkey" FOREIGN KEY ("busId") REFERENCES "public"."Bus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BusRoute" ADD CONSTRAINT "BusRoute_originId_fkey" FOREIGN KEY ("originId") REFERENCES "public"."City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BusRoute" ADD CONSTRAINT "BusRoute_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "public"."City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RecurringSchedule" ADD CONSTRAINT "RecurringSchedule_busId_fkey" FOREIGN KEY ("busId") REFERENCES "public"."Bus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RecurringSchedule" ADD CONSTRAINT "RecurringSchedule_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "public"."BusRoute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BusSchedule" ADD CONSTRAINT "BusSchedule_busId_fkey" FOREIGN KEY ("busId") REFERENCES "public"."Bus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BusSchedule" ADD CONSTRAINT "BusSchedule_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "public"."BusRoute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SeatLock" ADD CONSTRAINT "SeatLock_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "public"."BusSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SeatLock" ADD CONSTRAINT "SeatLock_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "public"."BusSeat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SeatLock" ADD CONSTRAINT "SeatLock_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SeatLock" ADD CONSTRAINT "SeatLock_rescheduleRequestId_fkey" FOREIGN KEY ("rescheduleRequestId") REFERENCES "public"."RescheduleRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Booking" ADD CONSTRAINT "Booking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Booking" ADD CONSTRAINT "Booking_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "public"."BusSchedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Passenger" ADD CONSTRAINT "Passenger_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Passenger" ADD CONSTRAINT "Passenger_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "public"."BusSeat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BookingHistory" ADD CONSTRAINT "BookingHistory_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RescheduleRequest" ADD CONSTRAINT "RescheduleRequest_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RescheduleRequest" ADD CONSTRAINT "RescheduleRequest_oldScheduleId_fkey" FOREIGN KEY ("oldScheduleId") REFERENCES "public"."BusSchedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RescheduleRequest" ADD CONSTRAINT "RescheduleRequest_newScheduleId_fkey" FOREIGN KEY ("newScheduleId") REFERENCES "public"."BusSchedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmailNotification" ADD CONSTRAINT "EmailNotification_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VerificationCode" ADD CONSTRAINT "VerificationCode_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AgentSession" ADD CONSTRAINT "AgentSession_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Duplicate payment prevention: at most ONE successful booking payment per booking.
CREATE UNIQUE INDEX "Payment_one_success_per_booking" ON "Payment"("bookingId") WHERE "status" = 'SUCCEEDED' AND "kind" = 'BOOKING';
