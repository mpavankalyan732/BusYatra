public with sharing class BusYatraQuoteReschedule {
    public class Request {
        @InvocableVariable(label='Verification Token' description='Customer verification token from the session context' required=true)
        public String verificationToken;
        @InvocableVariable(label='New Schedule ID' description='scheduleId of the option the customer chose (from Find Alternative Buses)' required=true)
        public String newScheduleId;
    }

    @InvocableMethod(label='BusYatra: Quote Reschedule' description='Temporarily holds seats on the chosen bus for 10 minutes and returns the exact fare difference and fee. Does NOT change the booking.')
    public static List<BusYatraRescheduleActions.Result> run(List<Request> requests) {
        List<BusYatraRescheduleActions.Result> out = new List<BusYatraRescheduleActions.Result>();
        for (Request r : requests) {
            try {
                Map<String, Object> d = BusYatraApi.post('quote', new Map<String, Object>{
                    'verificationToken' => r.verificationToken, 'newScheduleId' => r.newScheduleId });
                Decimal net = Decimal.valueOf(String.valueOf(d.get('netPayable')));
                String s = 'Seats ' + String.join((List<Object>) d.get('newSeatNumbers'), ', ') + ' are held until ' + d.get('expiresAt')
                    + ' (UTC). New departure ' + d.get('newDepartureAt') + ' UTC. Fare difference INR ' + d.get('fareDifference')
                    + ', reschedule fee INR ' + d.get('rescheduleFee') + '. '
                    + (net > 0 ? 'Customer pays INR ' + net : net < 0 ? 'Customer is refunded INR ' + net.abs() : 'No additional charge')
                    + '. Ask the customer to explicitly confirm. [rescheduleRequestId=' + d.get('rescheduleRequestId') + ']';
                out.add(BusYatraRescheduleActions.ok(s, d));
            } catch (Exception e) {
                out.add(BusYatraRescheduleActions.fail(e));
            }
        }
        return out;
    }
}
