public with sharing class BusYatraFindAlternatives {
    public class Request {
        @InvocableVariable(label='Verification Token' description='Customer verification token from the session context' required=true)
        public String verificationToken;
        @InvocableVariable(label='New Date' description='Requested travel date in YYYY-MM-DD (resolve words like "tomorrow" against today in India Standard Time)' required=true)
        public String newDate;
    }

    @InvocableMethod(label='BusYatra: Find Alternative Buses' description='Lists real buses on the same route for the requested date that have enough free seats, with estimated amount payable or refundable. Never invent options; only present what this returns.')
    public static List<BusYatraRescheduleActions.Result> run(List<Request> requests) {
        List<BusYatraRescheduleActions.Result> out = new List<BusYatraRescheduleActions.Result>();
        for (Request r : requests) {
            try {
                Map<String, Object> d = BusYatraApi.post('find-alternatives', new Map<String, Object>{
                    'verificationToken' => r.verificationToken, 'newDate' => r.newDate });
                List<Object> options = (List<Object>) d.get('options');
                String s;
                if (options.isEmpty()) {
                    s = 'No buses with enough free seats on ' + d.get('date') + '. Ask the customer for another date.';
                } else {
                    List<String> lines = new List<String>();
                    for (Object o : options) {
                        Map<String, Object> m = (Map<String, Object>) o;
                        Decimal net = Decimal.valueOf(String.valueOf(m.get('estimatedNetPayable')));
                        lines.add('Option ' + m.get('option') + ': ' + m.get('operator') + ' (' + m.get('busType') + '), departs '
                            + m.get('departureAt') + ' UTC, arrives ' + m.get('arrivalAt') + ' UTC, ' + m.get('availableSeats') + ' seats, '
                            + (net >= 0 ? 'customer pays about INR ' + net : 'refund of about INR ' + net.abs())
                            + ' [scheduleId=' + m.get('scheduleId') + ']');
                    }
                    s = String.join(lines, '\n') + '\nShow times in IST (UTC+5:30). Ask which option the customer wants.';
                }
                out.add(BusYatraRescheduleActions.ok(s, d));
            } catch (Exception e) {
                out.add(BusYatraRescheduleActions.fail(e));
            }
        }
        return out;
    }
}
