public with sharing class BusYatraRsFindAlternatives {
    public class Request {
        @InvocableVariable(label='Booking ID' description='The verified BusYatra booking ID, e.g. BUS202611040002' required=true)
        public String bookingId;
        @InvocableVariable(label='Customer Email' description='The booking email the customer gave' required=true)
        public String email;
        @InvocableVariable(label='New Date' description='New travel date in YYYY-MM-DD (convert relative dates like tomorrow using today in India Standard Time)' required=true)
        public String newDate;
    }

    @InvocableMethod(label='BusYatra: Find Alternative Buses' description='Lists real buses on the same route for the new date with seats available and the estimated amount to pay. Never invent options.')
    public static List<BusYatraRsApi.Result> run(List<Request> requests) {
        List<BusYatraRsApi.Result> out = new List<BusYatraRsApi.Result>();
        for (Request r : requests) {
            try {
                Map<String, Object> body = BusYatraRsApi.who(r.bookingId, r.email);
                body.put('newDate', r.newDate);
                Map<String, Object> d = BusYatraRsApi.post('find-alternatives', body);
                List<Object> opts = (List<Object>) d.get('options');
                if (opts == null || opts.isEmpty()) { out.add(BusYatraRsApi.ok('No buses with enough free seats were found on ' + d.get('date') + '. Ask the customer for another date.')); continue; }
                List<String> lines = new List<String>();
                for (Object o : opts) {
                    Map<String, Object> m = (Map<String, Object>) o;
                    lines.add('Option ' + m.get('option') + ': ' + m.get('operator') + ' (' + m.get('busType') + '), departs ' + m.get('departureAt') + ' UTC, arrives '
                        + m.get('arrivalAt') + ' UTC, ' + m.get('availableSeats') + ' seats free, estimated to pay INR ' + m.get('estimatedNetPayable') + ' [scheduleId=' + m.get('scheduleId') + ']');
                }
                out.add(BusYatraRsApi.ok(d.get('count') + ' option(s) on ' + d.get('date') + ' (times are UTC; IST = UTC+5:30):\n' + String.join(lines, '\n')));
            } catch (Exception e) {
                out.add(BusYatraRsApi.fail(e.getMessage()));
            }
        }
        return out;
    }
}