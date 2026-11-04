/**
 * Thin HTTP client for the BusYatra backend "agent action" API.
 * Endpoint + API key come from the Named Credential "BusYatra_API" (see docs/AGENTFORCE_SETUP.md),
 * so no secrets live in code. The backend is the source of truth for bookings and seat inventory;
 * these classes never change data themselves.
 */
public with sharing class BusYatraApi {
    public class BusYatraException extends Exception {}

    public static Map<String, Object> post(String action, Map<String, Object> body) {
        HttpRequest req = new HttpRequest();
        req.setEndpoint('callout:BusYatra_API/api/agent-actions/' + action);
        req.setMethod('POST');
        req.setHeader('Content-Type', 'application/json');
        req.setTimeout(20000);
        req.setBody(JSON.serialize(body));
        HttpResponse res = new Http().send(req);
        Map<String, Object> parsed = String.isBlank(res.getBody())
            ? new Map<String, Object>()
            : (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
        if (res.getStatusCode() >= 400) {
            Map<String, Object> err = (Map<String, Object>) parsed.get('error');
            String msg = err != null ? String.valueOf(err.get('message')) : res.getStatus();
            throw new BusYatraException(msg);
        }
        return parsed;
    }
}
