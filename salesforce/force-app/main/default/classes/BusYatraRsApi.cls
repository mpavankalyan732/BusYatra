/**
 * Shared helper for the BusYatra Reschedule Agent actions.
 * Calls the BusYatra backend through the Named Credential "BusYatra_API" (endpoint + API key live there),
 * and keeps a Bus_Reschedule__c audit record linked to the Bus_Booking__c (matched on Booking_ID__c /
 * Provider_Booking_Id__c = the BusYatra booking ID, e.g. BUS202611040002).
 * The backend is the source of truth: these classes never change bookings or seats themselves.
 */
public with sharing class BusYatraRsApi {
    public class ApiException extends Exception {}

    public class Result {
        @InvocableVariable(label='Success' description='True if the step succeeded')
        public Boolean success;
        @InvocableVariable(label='Summary' description='What happened, in plain words, to tell the customer. Only state facts from this summary.')
        public String summary;
        @InvocableVariable(label='Reschedule Request ID' description='rescheduleRequestId from Quote Reschedule; pass it to Confirm Reschedule')
        public String rescheduleRequestId;
    }

    public static Result ok(String summary) { Result r = new Result(); r.success = true; r.summary = summary; return r; }
    public static Result fail(String msg) { Result r = new Result(); r.success = false; r.summary = 'Not completed: ' + msg; return r; }

    public static Map<String, Object> post(String action, Map<String, Object> body) {
        HttpRequest req = new HttpRequest();
        req.setEndpoint('callout:BusYatra_API/api/agent-actions/' + action);
        req.setMethod('POST');
        req.setHeader('Content-Type', 'application/json');
        req.setTimeout(60000);
        req.setBody(JSON.serialize(body));
        HttpResponse res = new Http().send(req);
        Map<String, Object> parsed = String.isBlank(res.getBody()) ? new Map<String, Object>() : (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
        if (res.getStatusCode() >= 400) {
            Map<String, Object> err = (Map<String, Object>) parsed.get('error');
            throw new ApiException(err != null ? String.valueOf(err.get('message')) : res.getStatus());
        }
        return parsed;
    }

    public static Map<String, Object> who(String bookingId, String email) {
        return new Map<String, Object>{ 'bookingCode' => bookingId == null ? null : bookingId.trim().toUpperCase(), 'email' => email == null ? null : email.trim() };
    }

    public static Decimal num(Object o) { return o == null ? null : Decimal.valueOf(String.valueOf(o)); }
    public static Datetime dt(Object o) { return o == null ? null : (Datetime) JSON.deserialize('"' + String.valueOf(o) + '"', Datetime.class); }
    public static String seats(Object o) { return o == null ? '' : String.join((List<Object>) o, ', '); }

    /** Last Salesforce logging error in this transaction (null when the record saved). */
    public static String lastLogError;

    /** Insert or update the Bus_Reschedule__c audit row in system mode, linked to the Bus_Booking__c. Never throws. */
    public static void log(Map<String, Object> f) {
        lastLogError = new Logger().save(f);
    }

    private without sharing class Logger {
        String save(Map<String, Object> f) {
            try {
                Bus_Reschedule__c r = new Bus_Reschedule__c();
                for (String k : f.keySet()) {
                    Object v = f.get(k);
                    if (v instanceof String && String.isBlank((String) v)) continue;
                    if (v != null) r.put(k, v);
                }
                if (String.isBlank(r.Reschedule_Request_Id__c)) r.Reschedule_Request_Id__c = 'NOQUOTE-' + Datetime.now().getTime() + '-' + Math.abs(Crypto.getRandomInteger());
                String code = (String) f.get('Provider_Booking_Id__c');
                if (String.isNotBlank(code)) {
                    code = code.trim().toUpperCase();
                    List<Bus_Booking__c> b = [SELECT Id FROM Bus_Booking__c WHERE Provider_Booking_Id__c = :code OR Booking_ID__c = :code ORDER BY CreatedDate DESC LIMIT 1];
                    if (!b.isEmpty()) r.Bus_Booking__c = b[0].Id;
                }
                Database.UpsertResult ur = Database.upsert(r, Bus_Reschedule__c.Reschedule_Request_Id__c, false, AccessLevel.SYSTEM_MODE);
                if (ur.isSuccess()) return null;
                String msg = '';
                for (Database.Error e : ur.getErrors()) msg += e.getStatusCode() + ': ' + e.getMessage() + ' ' + e.getFields() + '; ';
                System.debug(LoggingLevel.ERROR, 'Bus_Reschedule__c save failed: ' + msg);
                return msg;
            } catch (Exception e) {
                System.debug(LoggingLevel.ERROR, 'Bus_Reschedule__c save failed: ' + e.getMessage());
                return e.getTypeName() + ': ' + e.getMessage();
            }
        }
    }

    /** Appends a note to the result when the Salesforce audit record could not be saved. */
    public static void noteLog(Result res) {
        if (res != null && lastLogError != null) res.summary += ' (Note for admin: Bus Reschedule record not saved - ' + lastLogError.left(200) + ')';
    }
}
