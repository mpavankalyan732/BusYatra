@IsTest
private class BusYatraRescheduleActionsTest {

    private class Mock implements HttpCalloutMock {
        Integer status;
        String body;
        Mock(Integer status, String body) { this.status = status; this.body = body; }
        public HttpResponse respond(HttpRequest req) {
            System.assert(req.getEndpoint().startsWith('callout:BusYatra_API/api/agent-actions/'), req.getEndpoint());
            HttpResponse res = new HttpResponse();
            res.setStatusCode(status);
            res.setBody(body);
            return res;
        }
    }

    @IsTest static void getBookingSummarises() {
        Test.setMock(HttpCalloutMock.class, new Mock(200,
            '{"bookingCode":"BUS202611030001","status":"CONFIRMED","origin":"Tirupati","destination":"Bangalore","journeyDate":"2026-11-10",' +
            '"departureAt":"2026-11-10T15:30:00Z","operator":"Garuda Roadways","seatNumbers":["A1","A2"],"canReschedule":true,"policy":"..."}'));
        BusYatraGetBooking.Request r = new BusYatraGetBooking.Request();
        r.verificationToken = 'tok';
        Test.startTest();
        List<BusYatraRescheduleActions.Result> res = BusYatraGetBooking.run(new List<BusYatraGetBooking.Request>{ r });
        Test.stopTest();
        System.assertEquals(true, res[0].success);
        System.assert(res[0].summary.contains('Tirupati to Bangalore'));
    }

    @IsTest static void alternativesListsOptions() {
        Test.setMock(HttpCalloutMock.class, new Mock(200,
            '{"date":"2026-11-11","count":1,"options":[{"option":1,"scheduleId":"s1","operator":"Kaveri Express","busType":"AC SLEEPER",' +
            '"departureAt":"2026-11-11T15:30:00Z","arrivalAt":"2026-11-11T21:00:00Z","availableSeats":12,"estimatedNetPayable":150}]}'));
        BusYatraFindAlternatives.Request r = new BusYatraFindAlternatives.Request();
        r.verificationToken = 'tok';
        r.newDate = '2026-11-11';
        List<BusYatraRescheduleActions.Result> res = BusYatraFindAlternatives.run(new List<BusYatraFindAlternatives.Request>{ r });
        System.assert(res[0].summary.contains('scheduleId=s1'));
    }

    @IsTest static void quoteAndConfirm() {
        Test.setMock(HttpCalloutMock.class, new Mock(200,
            '{"rescheduleRequestId":"q1","expiresAt":"x","newDepartureAt":"y","newSeatNumbers":["B1"],"fareDifference":-100,"rescheduleFee":50,"netPayable":-50,' +
            '"bookingCode":"BUS202611030001","seatNumbers":["B1"],"message":"ok","success":true}'));
        BusYatraQuoteReschedule.Request q = new BusYatraQuoteReschedule.Request();
        q.verificationToken = 'tok';
        q.newScheduleId = 's1';
        System.assert(BusYatraQuoteReschedule.run(new List<BusYatraQuoteReschedule.Request>{ q })[0].summary.contains('refunded'));

        BusYatraConfirmReschedule.Request c = new BusYatraConfirmReschedule.Request();
        c.verificationToken = 'tok';
        c.rescheduleRequestId = 'q1';
        c.customerConfirmed = true;
        System.assertEquals(true, BusYatraConfirmReschedule.run(new List<BusYatraConfirmReschedule.Request>{ c })[0].success);
    }

    @IsTest static void confirmRequiresApproval() {
        BusYatraConfirmReschedule.Request c = new BusYatraConfirmReschedule.Request();
        c.verificationToken = 'tok';
        c.rescheduleRequestId = 'q1';
        c.customerConfirmed = false;
        System.assertEquals(false, BusYatraConfirmReschedule.run(new List<BusYatraConfirmReschedule.Request>{ c })[0].success);
    }

    @IsTest static void backendErrorsAreSurfaced() {
        Test.setMock(HttpCalloutMock.class, new Mock(409, '{"success":false,"error":{"code":"RESCHEDULE_NOT_ALLOWED","message":"Booking cancelled"}}'));
        BusYatraGetBooking.Request r = new BusYatraGetBooking.Request();
        r.verificationToken = 'tok';
        List<BusYatraRescheduleActions.Result> res = BusYatraGetBooking.run(new List<BusYatraGetBooking.Request>{ r });
        System.assertEquals(false, res[0].success);
        System.assert(res[0].summary.contains('Booking cancelled'));
    }
}
