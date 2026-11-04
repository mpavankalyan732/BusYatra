# Agentforce rescheduling agent — setup

Two directions of traffic:

1. **Website → Agentforce**: the backend opens an Agent API session and relays the customer's messages (`services/agent/agentforceProvider.js`).
2. **Agentforce → backend**: the agent's actions are Apex invocables (`salesforce/force-app/main/default/classes`) that call `POST /api/agent-actions/*` through a Named Credential.

Prerequisites: an org with Agentforce enabled (e.g. an Agentforce-enabled Developer Edition), Einstein / Agentforce turned on in Setup, and the CRM setup from [SALESFORCE_SETUP.md](SALESFORCE_SETUP.md) done (the Apex classes are deployed together with the objects).

> Salesforce renames Setup screens fairly often. If a label below doesn't match your org exactly, look for the closest equivalent.

## 1. Let Salesforce call the backend (Named Credential)

The backend authenticates Apex calls with the shared secret `AGENT_ACTION_API_KEY` sent in the `x-agent-api-key` header.

1. **Setup → Named Credentials → External Credentials → New**
   - Label/Name: `BusYatra_API_Cred`, Authentication Protocol: **Custom**.
   - Add a **Principal** named `BusYatraKey` (Named Principal) with an authentication parameter `ApiKey` = your `AGENT_ACTION_API_KEY` value.
2. **Named Credentials → New**
   - Label/Name: **`BusYatra_API`** (the Apex code uses `callout:BusYatra_API`).
   - URL: your backend base URL, e.g. `https://busyatra-api.onrender.com` (no trailing `/api`).
   - External Credential: `BusYatra_API_Cred`. Uncheck *Generate Authorization Header*.
   - Custom Header: name `x-agent-api-key`, value `{!$Credential.BusYatra_API_Cred.ApiKey}`.
3. Give the agent's running user access to the external credential principal: in a permission set → *External Credential Principal Access* → add `BusYatra_API_Cred - BusYatraKey`. Also add Apex class access to the four `BusYatra*` action classes.

Test from **Developer Console → Execute Anonymous**:
```apex
System.debug(BusYatraApi.post('get-booking', new Map<String,Object>{'verificationToken' => 'x'}));
```
A `Customer verification token is missing or expired` error means the callout and API key work (the token is fake).

## 2. Create the agent

**Setup → Agentforce Agents → New Agent** → template **Agentforce Service Agent**.

- Name: `BusYatra Reschedule Agent`
- Role/description: *Helps BusYatra customers reschedule an existing bus booking.*
- Company: *BusYatra, an intercity bus booking platform in India.*

### Context variables

In Agent Builder, open **Context Variables / Variables** and create two **Text** variables that can be **set via API**:

| Name | Purpose |
| --- | --- |
| `VerificationToken` | Short-lived token proving the customer passed email OTP for one booking |
| `BookingCode` | The verified booking ID |

The backend passes both when it starts a session.

### Topic: Booking Rescheduling

- **Classification description**: *Customer wants to change the date or time of an existing confirmed bus booking, or asks about rescheduling rules.*
- **Scope**: *Only reschedule the customer's verified booking on the same route. Do not create new bookings, cancel bookings, or discuss other customers' bookings.*
- **Instructions** (one per line in Agent Builder):
  1. Always call *BusYatra: Get Booking* first using the VerificationToken context variable. Tell the customer the route, date and seats it returns.
  2. If Get Booking says the booking cannot be rescheduled (for example it is cancelled, too close to departure, or already rescheduled the maximum times), explain the reason and stop. Never attempt to reschedule a cancelled booking.
  3. Ask for the new travel date. Convert relative dates like "tomorrow" to YYYY-MM-DD using today's date in India Standard Time.
  4. Call *BusYatra: Find Alternative Buses*. Only present the options it returns — never invent buses, times, seats or prices. Show times in IST.
  5. When the customer picks an option, call *BusYatra: Quote Reschedule* with that option's scheduleId. Tell them the new seats, the fare difference, the reschedule fee, and the total to pay or refund.
  6. Ask for explicit confirmation. Only if the customer's latest message clearly says yes, call *BusYatra: Confirm Reschedule* with customerConfirmed = true. If they say no or are unsure, do not confirm.
  7. If any action returns an error, tell the customer plainly and offer to try a different date. Never claim a change succeeded unless Confirm Reschedule returned success.
  8. Never reveal or repeat the VerificationToken.

### Actions

Add four **Apex** agent actions (*New Agent Action → Reference Action Type: Apex → Invocable Method*):

| Action | Apex class | Inputs | Notes |
| --- | --- | --- | --- |
| BusYatra: Get Booking | `BusYatraGetBooking` | verificationToken ← `VerificationToken` variable; bookingCode (optional) | |
| BusYatra: Find Alternative Buses | `BusYatraFindAlternatives` | verificationToken ← variable; newDate | |
| BusYatra: Quote Reschedule | `BusYatraQuoteReschedule` | verificationToken ← variable; newScheduleId | |
| BusYatra: Confirm Reschedule | `BusYatraConfirmReschedule` | verificationToken ← variable; rescheduleRequestId; customerConfirmed | Mark **Require user confirmation** if your org offers it |

For each action: tick *Show in conversation* on the `Summary` output, and map the `verificationToken` input to the `VerificationToken` context variable so the LLM never has to handle the token itself. Add all four actions to the *Booking Rescheduling* topic. **Activate** the agent.

## 3. Let the backend call the Agent API

1. Create a Connected App / External Client App for the agent (you can reuse the one from the CRM setup) with:
   - Client Credentials Flow enabled, Run As = a user with access to the agent.
   - OAuth scopes: `api`, `refresh_token, offline_access`, `chatbot_api`, `sfap_api`.
   - *Issue JWT-based access tokens for named users* enabled (required by the Agent API).
2. In **Agent Builder → Connections**, add an **API** connection and link this app to the agent.
3. Copy the **Agent ID** (starts with `0Xx`, visible in the agent's URL in Setup).
4. Set on the backend:

```
AGENTFORCE_CONFIGURATION={"agentId":"0XxXXXXXXXXXXXXXXX","myDomainUrl":"https://<your-domain>.my.salesforce.com","clientId":"<key>","clientSecret":"<secret>"}
```

`apiBaseUrl` defaults to `https://api.salesforce.com/einstein/ai-agent/v1`; `clientId`/`clientSecret` default to the `SALESFORCE_*` values if omitted.

5. Restart the API. The log shows `Agent: Agentforce` and the chat banner changes from **Mock agent** to **Powered by Salesforce Agentforce**.

## 4. Testing

- **Apex unit tests**: `sf apex run test --class-names BusYatraRescheduleActionsTest --target-org busyatra --result-format human`
- **Agent Builder**: use the conversation preview. Set `VerificationToken` manually to a real token from `POST /api/reschedule/verify/complete` to exercise real data.
- **Testing Center**: create test cases for: happy path; cancelled booking (must refuse); "no" at confirmation (must not change); unavailable date (must say none found).
- **End to end**: on the website use *Reschedule My Booking* with a real booking, then check Admin → Bookings → history (`RESCHEDULED` by `AGENTFORCE`) and the Salesforce booking record.

## Mock agent (no Agentforce credentials)

When `AGENTFORCE_CONFIGURATION` is empty, `mockAgentProvider.js` is used. It is a deterministic rule-based state machine, **not** Agentforce, and every session response carries `provider.isMock: true` with a label shown in the UI. It calls the exact same `rescheduleService` functions, so swapping in Agentforce changes only the conversation layer.
