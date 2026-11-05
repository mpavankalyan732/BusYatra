public with sharing class BusYatraRsQuote {
    public class Request {
        @InvocableVariable(label='Booking ID' description='The verified BusYatra booking ID' required=true)
        public String bookingId;
        @InvocableVariable(label='Customer Email' description='The booking email the customer gave' required=true)
        public String email;
        @InvocableVariable(label='New Schedule ID' description='scheduleId of the option the customer chose, from Find Alternative Buses' required=true)
        public String newScheduleId;
    }

    @InvocableMethod(label='BusYatra: Quote Reschedule' description='Holds seats on the chosen bus for 10 minutes and returns the exact fare difference, fee and total. Does NOT change the booking. Records a Bus Reschedule (Quoted).')
    public static List<BusYatraRsApi.Result> run(List<Request> requests) {
        List<BusYatraRsApi.Result> out = new List<BusYatraRsApi.Result>();
        List<Map<String, Object>> logs = new List<Map<String, Object>>();
        for (Request r : requests) {
            try {
                Map<String, Object> cur = BusYatraRsApi.post('get-booking', BusYatraRsApi.who(r.bookingId, r.email));
                Map<String, Object> body = BusYatraRsApi.who(r.bookingId, r.email);
                body.put('newScheduleId', r.newScheduleId);
                Map<String, Object> d = BusYatraRsApi.post('quote', body);
                Decimal net = BusYatraRsApi.num(d.get('netPayable'));
                BusYatraRsApi.Result res = BusYatraRsApi.ok('Quote ready (not yet confirmed). New departure ' + d.get('newDepartureAt') + ' UTC, new seats '
                    + BusYatraRsApi.seats(d.get('newSeatNumbers')) + '. Fare difference INR ' + d.get('fareDifference') + ', reschedule fee INR ' + d.get('rescheduleFee') + '. '
                    + (net > 0 ? 'Customer pays INR ' + net : net < 0 ? 'Customer is refunded INR ' + net.abs() : 'No extra charge')
                    + '. Seats are held until ' + d.get('expiresAt') + ' UTC. Ask the customer to reply Yes to confirm.');
                res.rescheduleRequestId = String.valueOf(d.get('rescheduleRequestId'));
                out.add(res);
                logs.add(new Map<String, Object>{
                    'Reschedule_Request_Id__c' => res.rescheduleRequestId, 'Provider_Booking_Id__c' => String.valueOf(cur.get('bookingCode')),
                    'Customer_Email__c' => r.email == null ? null : r.email.trim(), 'Status__c' => 'Quoted', 'Channel__c' => 'Agentforce Enhanced Chat',
                    'Old_Departure__c' => BusYatraRsApi.dt(cur.get('departureAt')), 'Old_Seat_Numbers__c' => BusYatraRsApi.seats(cur.get('seatNumbers')),
                    'New_Departure__c' => BusYatraRsApi.dt(d.get('newDepartureAt')), 'New_Seat_Numbers__c' => BusYatraRsApi.seats(d.get('newSeatNumbers')),
                    'Fare_Difference__c' => BusYatraRsApi.num(d.get('fareDifference')), 'Reschedule_Fee__c' => BusYatraRsApi.num(d.get('rescheduleFee')),
                    'Net_Payable__c' => net, 'Quote_Expires_At__c' => BusYatraRsApi.dt(d.get('expiresAt')) });
            } catch (Exception e) {
                out.add(BusYatraRsApi.fail(e.getMessage()));
            }
        }
        for (Integer i = 0; i < logs.size(); i++) { BusYatraRsApi.log(logs[i]); if (i < out.size()) BusYatraRsApi.noteLog(out[i]); }
        return out;
    }
}
