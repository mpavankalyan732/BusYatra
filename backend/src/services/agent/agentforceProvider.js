/**
 * Salesforce Agentforce provider — uses the Agentforce Agent API.
 *   POST {apiBaseUrl}/agents/{agentId}/sessions          start session
 *   POST {apiBaseUrl}/sessions/{sessionId}/messages      send a message (synchronous)
 *   DELETE {apiBaseUrl}/sessions/{sessionId}             end session
 * Auth: OAuth 2.0 client credentials against the org's My Domain token endpoint.
 *
 * The verified booking context is passed as API-settable context variables
 * (VerificationToken, BookingCode). The agent's actions (Apex, see /salesforce) call
 * back into /api/agent-actions/* with that token, so the agent can only ever see or
 * change the booking the customer verified via OTP.
 */
import crypto from 'node:crypto';
import { config } from '../../config/env.js';
import { fetchClientCredentialsToken } from '../salesforce/salesforceClient.js';

let tokenCache = null;

function cfg() {
  const a = config.agentforce;
  return {
    agentId: a.agentId,
    myDomainUrl: (a.myDomainUrl || config.salesforce.instanceUrl).replace(/\/$/, ''),
    apiBaseUrl: (a.apiBaseUrl || 'https://api.salesforce.com/einstein/ai-agent/v1').replace(/\/$/, ''),
    clientId: a.clientId || config.salesforce.clientId,
    clientSecret: a.clientSecret || config.salesforce.clientSecret,
  };
}

async function token(force = false) {
  if (!force && tokenCache && tokenCache.expiresAt > Date.now()) return tokenCache.value;
  const c = cfg();
  const body = await fetchClientCredentialsToken({ tokenUrl: `${c.myDomainUrl}/services/oauth2/token`, clientId: c.clientId, clientSecret: c.clientSecret });
  tokenCache = { value: body.access_token, expiresAt: Date.now() + 25 * 60 * 1000 };
  return tokenCache.value;
}

async function call(method, path, body, extraHeaders = {}, retried = false) {
  const res = await fetch(`${cfg().apiBaseUrl}${path}`, {
    method,
    headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json', Accept: 'application/json', ...extraHeaders },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && !retried) {
    await token(true);
    return call(method, path, body, extraHeaders, true);
  }
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`Agentforce API ${method} ${path} failed (${res.status}): ${json.message || text}`);
  return json;
}

const toMessages = (json) =>
  (json.messages || [])
    .filter((m) => m.message || m.text)
    .map((m) => ({ role: 'agent', text: m.message || m.text, agentforceType: m.type }));

export const agentforceProvider = {
  name: 'AGENTFORCE',
  label: 'Salesforce Agentforce',
  isMock: false,

  async start(session, { verificationToken, bookingCode }) {
    const c = cfg();
    const json = await call('POST', `/agents/${c.agentId}/sessions`, {
      externalSessionKey: crypto.randomUUID(),
      instanceConfig: { endpoint: c.myDomainUrl },
      streamingCapabilities: { chunkTypes: ['Text'] },
      bypassUser: true,
      variables: [
        { name: 'VerificationToken', type: 'Text', value: verificationToken },
        { name: 'BookingCode', type: 'Text', value: bookingCode },
      ],
    });
    const messages = toMessages(json);
    // Kick off with the customer's intent so the agent retrieves the verified booking.
    const first = await this.message({ ...session, providerSessionId: json.sessionId, sequenceId: 0 },
      `I want to reschedule my bus ticket. My booking ID is ${bookingCode} and I have already verified my identity.`);
    return { providerSessionId: json.sessionId, sequenceId: first.sequenceId, messages: [...messages, ...first.messages] };
  },

  async message(session, text) {
    const sequenceId = (session.sequenceId || 0) + 1;
    const json = await call('POST', `/sessions/${session.providerSessionId}/messages`, {
      message: { sequenceId, type: 'Text', text },
      variables: [],
    });
    return { sequenceId, messages: toMessages(json) };
  },

  async end(session) {
    if (!session.providerSessionId) return;
    await call('DELETE', `/sessions/${session.providerSessionId}`, null, { 'x-session-end-reason': 'UserRequest' }).catch(() => {});
  },
};
