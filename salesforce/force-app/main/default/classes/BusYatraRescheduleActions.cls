/**
 * Agentforce actions for the "Booking Rescheduling" topic.
 * Each invocable returns a plain-language summary for the agent plus raw JSON.
 * Every call requires the customer's verificationToken (issued by the BusYatra
 * backend after email-OTP verification and passed into the agent session as the
 * VerificationToken context variable), so the agent can only act on the verified booking.
 *
 * Invocable methods must live in separate classes; these inner classes are the shared I/O types.
 */
public with sharing class BusYatraRescheduleActions {

    public class Result {
        @InvocableVariable(label='Success' description='True if the action completed')
        public Boolean success;
        @InvocableVariable(label='Summary' description='Plain-language result to tell the customer')
        public String summary;
        @InvocableVariable(label='Details JSON' description='Raw JSON returned by the BusYatra backend')
        public String detailsJson;
    }

    public static Result ok(String summary, Map<String, Object> data) {
        Result r = new Result();
        r.success = true;
        r.summary = summary;
        r.detailsJson = JSON.serialize(data);
        return r;
    }

    public static Result fail(Exception e) {
        Result r = new Result();
        r.success = false;
        r.summary = 'The booking system returned an error: ' + e.getMessage() + ' Do not guess; tell the customer and offer alternatives.';
        r.detailsJson = '{}';
        return r;
    }
}
