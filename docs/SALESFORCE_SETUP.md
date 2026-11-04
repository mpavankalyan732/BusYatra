# Salesforce CRM setup

The backend pushes every confirmed / rescheduled / cancelled booking into Salesforce. You need: the custom objects and fields, a Connected App (or External Client App) using the **OAuth 2.0 Client Credentials** flow, and four env vars.

## 1. Deploy objects and fields

The metadata is in [`salesforce/force-app`](../salesforce/force-app). With the [Salesforce CLI](https://developer.salesforce.com/tools/salesforcecli):

```bash
cd salesforce
sf org login web --alias busyatra          # log in to your org (Developer Edition works)
sf project deploy start --target-org busyatra
```

This creates:

**Contact** (standard) — new field
| Field | Type | Notes |
| --- | --- | --- |
| `BusApp_Customer_Key__c` | Text(120), External ID, Unique | lower-cased customer email |

**Bus_Booking__c** (custom, auto-number name `BB-000001`)
| Field | Type |
| --- | --- |
| `Booking_ID__c` | Text(20), **External ID, Unique** |
| `Customer__c` | Lookup(Contact) |
| `Origin_City__c`, `Destination_City__c` | Text(80) |
| `Journey_Date__c` | Date |
| `Bus_Name__c` | Text(160) |
| `Departure_Time__c`, `Arrival_Time__c` | Date/Time |
| `Seat_Numbers__c` | Text(255) |
| `Passenger_Count__c`, `Reschedule_Count__c` | Number(3,0) |
| `Total_Amount__c` | Currency(10,2) |
| `Payment_Status__c`, `Booking_Status__c` | Text(40) |

**Bus_Passenger__c** (custom, detail of Bus_Booking__c)
| Field | Type |
| --- | --- |
| `Booking__c` | Master-Detail(Bus_Booking__c) |
| `Passenger_Key__c` | Text(40), **External ID, Unique** |
| `Passenger_Name__c` | Text(80) |
| `Age__c` | Number(3,0) |
| `Gender__c` | Text(10) |
| `Seat_Number__c` | Text(10) |

After deploying, add the fields to page layouts and grant field-level security to the integration user's profile / permission set (Setup → Object Manager → field → *Set Field-Level Security*).

## 2. Integration user and Connected App

1. **Setup → Users**: create (or choose) an integration user. Give it a permission set with Read/Create/Edit on Contact, Bus_Booking__c, Bus_Passenger__c and their fields, plus *API Enabled*.
2. **Setup → App Manager → New Connected App** (or *External Client App Manager → New*):
   - Enable OAuth Settings. Callback URL: `https://localhost` (unused).
   - Scopes: `Manage user data via APIs (api)`, `Perform requests at any time (refresh_token, offline_access)`.
   - Tick **Enable Client Credentials Flow**.
3. After saving: **Manage → Edit Policies → Client Credentials Flow → Run As** = the integration user.
4. **Manage Consumer Details** → copy *Consumer Key* and *Consumer Secret*.

## 3. Backend environment variables

```
SALESFORCE_CLIENT_ID=<consumer key>
SALESFORCE_CLIENT_SECRET=<consumer secret>
SALESFORCE_INSTANCE_URL=https://<your-domain>.my.salesforce.com
SALESFORCE_TOKEN_URL=https://<your-domain>.my.salesforce.com/services/oauth2/token
SALESFORCE_API_VERSION=v61.0
```

The client-credentials flow must use your **My Domain** URL (not `login.salesforce.com`). Tokens are cached in server memory only and never sent to the browser.

## 4. Verify

1. Restart the API — the log line shows `Salesforce: on`; `GET /api/health` shows `salesforce: configured`.
2. Make a booking. The ticket page's "Salesforce CRM sync" card should turn **SYNCED** within seconds.
3. In Salesforce, open the Contact and its *Bus Bookings* related list.

## How sync behaves

- Writes are upserts on external IDs → retries never create duplicates.
- If Salesforce is down, the booking is still confirmed in PostgreSQL; the booking gets `sfSyncStatus=FAILED` with the error text, and the retry job retries with exponential backoff (up to 8 attempts). Admins can force a retry from **Admin → Bookings → Manage → Retry Salesforce sync**.
- Bookings created while Salesforce wasn't configured are marked `NOT_CONFIGURED`; use the admin retry to push them later.
