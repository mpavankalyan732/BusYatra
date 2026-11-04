/**
 * Minimal Salesforce REST client using the OAuth 2.0 Client Credentials flow
 * (Connected App / External Client App with "Enable Client Credentials Flow" and a Run-As user).
 * Tokens live only in server memory and are never sent to the browser.
 */
import { config, salesforceConfigured } from '../../config/env.js';

let cached = null; // { accessToken, instanceUrl, expiresAt }

export class SalesforceError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function fetchToken({ tokenUrl, clientId, clientSecret }) {
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new SalesforceError(`Salesforce OAuth failed: ${body.error_description || body.error || res.status}`, res.status, body);
  return body;
}

export async function getAccessToken(force = false) {
  if (!salesforceConfigured()) throw new SalesforceError('Salesforce is not configured', 0);
  if (!force && cached && cached.expiresAt > Date.now()) return cached;
  const body = await fetchToken(config.salesforce);
  cached = {
    accessToken: body.access_token,
    instanceUrl: (config.salesforce.instanceUrl || body.instance_url).replace(/\/$/, ''),
    // Client-credentials tokens don't always include expires_in; refresh conservatively.
    expiresAt: Date.now() + 25 * 60 * 1000,
  };
  return cached;
}

/** Generic token fetch for other Salesforce endpoints (used by the Agentforce provider). */
export const fetchClientCredentialsToken = fetchToken;

export async function sfRequest(method, path, body, { retryOn401 = true } = {}) {
  const { accessToken, instanceUrl } = await getAccessToken();
  const url = `${instanceUrl}/services/data/${config.salesforce.apiVersion}${path}`;
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && retryOn401) {
    await getAccessToken(true);
    return sfRequest(method, path, body, { retryOn401: false });
  }
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = Array.isArray(json) ? json.map((e) => `${e.errorCode}: ${e.message}`).join('; ') : text;
    throw new SalesforceError(`Salesforce ${method} ${path} failed (${res.status}): ${msg}`, res.status, json);
  }
  return json;
}

/** Upsert by external ID: PATCH /sobjects/{Object}/{ExtIdField}/{value} */
export const upsertByExternalId = (sobject, field, value, record) =>
  sfRequest('PATCH', `/sobjects/${sobject}/${field}/${encodeURIComponent(value)}`, record);
