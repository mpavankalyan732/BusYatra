public with sharing class BusYatraConfirmReschedule {
    public class Request {
        @InvocableVariable(label='Verification Token' description='Customer verification token from the session context' required=true)
        public String verificationToken;
        @InvocableVariable(label='Reschedule Request ID' description='rescheduleRequestId returned by Quote Reschedule' required=true)
        public String rescheduleRequestId;
        @InvocableVariable(label='Customer Confirmed' description='Set to true ONLY if the customer explicitly said yes to the quoted change in their latest message' required=true)
        public Boolean customerConfirmed;
    }

    @InvocableMethod(label='BusYatra: Confirm Reschedule' description='Applies a quoted reschedule after explicit customer approval. Updates the booking, releases old seats, records history, syncs Salesforce and emails a revised ticket.')
    public static List<BusYatraRescheduleActions.Result> run(List<Request> requests) {
        List<BusYatraRescheduleActions.Result> out = new List<BusYatraRescheduleActions.Result>();
        for (Request r : requests) {
            try {
                if (r.customerConfirmed != true) {
                    throw new BusYatraApi.BusYatraException('Customer has not confirmed the change');
                }
                Map<String, Object> d = BusYatraApi.post('confirm', new Map<String, Object>{
                    'verificationToken' => r.verificationToken,
                    'rescheduleRequestId' => r.rescheduleRequestId,
                    'customerConfirmed' => true });
                String s = 'Rescheduled. Booking ' + d.get('bookingCode') + ' now departs ' + d.get('newDepartureAt')
                    + ' UTC, seats ' + String.join((List<Object>) d.get('seatNumbers'), ', ') + '. ' + d.get('message');
                out.add(BusYatraRescheduleActions.ok(s, d));
            } catch (Exception e) {
                out.add(BusYatraRescheduleActions.fail(e));
            }
        }
        return out;
    }
}
