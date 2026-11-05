public with sharing class BusYatraRsGetBooking {
    public class Request {
        @InvocableVariable(label='Booking ID' description='The BusYatra booking ID (Provider Booking Id) the customer gave, e.g. BUS202611040002. Never guess.' required=true)
        public String bookingId;
        @InvocableVariable(label='Customer Email' description='The email address the customer used when booking. Ask the customer for it.' required=true)
        public String email;
    }

    @InvocableMethod(label='BusYatra: Get Booking' description='Verifies the customer by Booking ID + booking email and returns the booking (route, date, time, seats) and whether it can be rescheduled under the policy.')
    public static List<BusYatraRsApi.Result> run(List<Request> requests) {
        List<BusYatraRsApi.Result> out = new List<BusYatraRsApi.Result>();
        for (Request r : requests) {
            try {
                Map<String, Object> d = BusYatraRsApi.post('get-booking', BusYatraRsApi.who(r.bookingId, r.email));
                Boolean can = d.get('canReschedule') == true;
                String s = 'Verified booking ' + d.get('bookingCode') + ' (' + d.get('status') + '): ' + d.get('origin') + ' to ' + d.get('destination')
                    + ', departs ' + d.get('departureAt') + ' UTC, operator ' + d.get('operator') + ', seats ' + BusYatraRsApi.seats(d.get('seatNumbers'))
                    + ', ' + d.get('passengerCount') + ' passenger(s), paid INR ' + d.get('totalAmount') + '. '
                    + (can ? 'This booking CAN be rescheduled. ' : 'This booking CANNOT be rescheduled: ' + d.get('reason') + ' ')
                    + 'Policy: ' + d.get('policy');
                out.add(BusYatraRsApi.ok(s));
            } catch (Exception e) {
                out.add(BusYatraRsApi.fail(e.getMessage()));
            }
        }
        return out;
    }
}