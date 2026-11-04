public with sharing class BusYatraGetBooking {
    public class Request {
        @InvocableVariable(label='Verification Token' description='Customer verification token from the session context ($Context.VerificationToken)' required=true)
        public String verificationToken;
        @InvocableVariable(label='Booking ID' description='Booking ID the customer mentioned, e.g. BUS202611030001')
        public String bookingCode;
    }

    @InvocableMethod(label='BusYatra: Get Booking' description='Retrieves the verified customer\'s bus booking and whether it can be rescheduled, including the reschedule policy.')
    public static List<BusYatraRescheduleActions.Result> run(List<Request> requests) {
        List<BusYatraRescheduleActions.Result> out = new List<BusYatraRescheduleActions.Result>();
        for (Request r : requests) {
            try {
                Map<String, Object> d = BusYatraApi.post('get-booking', new Map<String, Object>{
                    'verificationToken' => r.verificationToken, 'bookingCode' => r.bookingCode });
                String s = 'Booking ' + d.get('bookingCode') + ' (' + d.get('status') + '): ' + d.get('origin') + ' to ' + d.get('destination')
                    + ' on ' + d.get('journeyDate') + ', departing ' + d.get('departureAt') + ' (UTC) with ' + d.get('operator')
                    + ', seats ' + String.join((List<Object>) d.get('seatNumbers'), ', ') + '. '
                    + (d.get('canReschedule') == true ? 'It can be rescheduled. ' : 'It CANNOT be rescheduled: ' + d.get('reason') + ' ')
                    + 'Policy: ' + d.get('policy');
                out.add(BusYatraRescheduleActions.ok(s, d));
            } catch (Exception e) {
                out.add(BusYatraRescheduleActions.fail(e));
            }
        }
        return out;
    }
}
