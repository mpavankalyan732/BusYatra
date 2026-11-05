public with sharing class BusYatraRsConfirm {
    public class Request {
        @InvocableVariable(label='Booking ID' description='The verified BusYatra booking ID' required=true)
        public String bookingId;
        @InvocableVariable(label='Customer Email' description='The booking email the customer gave' required=true)
        public String email;
        @InvocableVariable(label='Reschedule Request ID' description='rescheduleRequestId returned by Quote Reschedule' required=true)
        public String rescheduleRequestId;
        @InvocableVariable(label='Customer Confirmed' description='true ONLY if the customer explicitly said yes to the quoted change in their latest message' required=true)
        public Boolean customerConfirmed;
    }

    @InvocableMethod(label='BusYatra: Confirm Reschedule' description='Applies a quoted reschedule after explicit customer approval: moves the booking and seats in BusYatra, emails a revised ticket, syncs Salesforce and marks the Bus Reschedule Completed.')
    public static List<BusYatraRsApi.Result> run(List<Request> requests) {
        List<BusYatraRsApi.Result> out = new List<BusYatraRsApi.Result>();
        List<Map<String, Object>> logs = new List<Map<String, Object>>();
        for (Request r : requests) {
            if (r.customerConfirmed != true) {
                out.add(BusYatraRsApi.fail('The customer has not explicitly confirmed, so the booking was NOT changed.'));
                logs.add(new Map<String, Object>{ 'Reschedule_Request_Id__c' => r.rescheduleRequestId, 'Provider_Booking_Id__c' => r.bookingId, 'Customer_Email__c' => r.email, 'Channel__c' => 'Agentforce Enhanced Chat', 'Status__c' => 'Declined', 'Message__c' => 'Customer did not confirm' });
                continue;
            }
            try {
                Map<String, Object> body = BusYatraRsApi.who(r.bookingId, r.email);
                body.put('rescheduleRequestId', r.rescheduleRequestId);
                body.put('customerConfirmed', true);
                Map<String, Object> d = BusYatraRsApi.post('confirm', body);
                BusYatraRsApi.Result res = BusYatraRsApi.ok('Rescheduled successfully. Booking ' + d.get('bookingCode') + ' now departs ' + d.get('newDepartureAt')
                    + ' UTC, seats ' + BusYatraRsApi.seats(d.get('seatNumbers')) + '. Amount settled INR ' + d.get('netPayable') + '. ' + d.get('message'));
                res.rescheduleRequestId = r.rescheduleRequestId;
                out.add(res);
                logs.add(new Map<String, Object>{ 'Reschedule_Request_Id__c' => r.rescheduleRequestId, 'Provider_Booking_Id__c' => r.bookingId, 'Customer_Email__c' => r.email, 'Channel__c' => 'Agentforce Enhanced Chat', 'Status__c' => 'Completed',
                    'New_Departure__c' => BusYatraRsApi.dt(d.get('newDepartureAt')), 'New_Seat_Numbers__c' => BusYatraRsApi.seats(d.get('seatNumbers')),
                    'Message__c' => String.valueOf(d.get('message')).left(250) });
            } catch (Exception e) {
                out.add(BusYatraRsApi.fail(e.getMessage() + ' The booking was NOT changed.'));
                logs.add(new Map<String, Object>{ 'Reschedule_Request_Id__c' => r.rescheduleRequestId, 'Provider_Booking_Id__c' => r.bookingId, 'Customer_Email__c' => r.email, 'Channel__c' => 'Agentforce Enhanced Chat', 'Status__c' => 'Failed', 'Message__c' => e.getMessage().left(255) });
            }
        }
        for (Integer i = 0; i < logs.size(); i++) { BusYatraRsApi.log(logs[i]); if (i < out.size()) BusYatraRsApi.noteLog(out[i]); }
        return out;
    }
}
