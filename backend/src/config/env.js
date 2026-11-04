import 'dotenv/config';

const num = (v, d) => (v === undefined || v === '' ? d : Number(v));
const rupeesToPaise = (v, d) => Math.round(num(v, d) * 100);

function parseAgentforce(raw) {
  if (!raw) return null;
  try {
    const cfg = JSON.parse(raw);
    return cfg && cfg.agentId ? cfg : null;
  } catch {
    console.warn('[config] AGENTFORCE_CONFIGURATION is not valid JSON - falling back to mock agent');
    return null;
  }
}

const nodeEnv = process.env.NODE_ENV || 'development';
const jwtSecret = process.env.JWT_SECRET || (nodeEnv === 'production' ? '' : 'dev-only-insecure-secret');
if (!jwtSecret) throw new Error('JWT_SECRET must be set in production');

export const config = {
  nodeEnv,
  isProd: nodeEnv === 'production',
  port: num(process.env.PORT, 4000),
  jwtSecret,
  frontendUrl: (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, ''),
  corsOrigins: (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),

  booking: {
    seatLockMinutes: num(process.env.SEAT_LOCK_MINUTES, 10),
    maxSeatsPerBooking: 6,
    taxRate: num(process.env.TAX_RATE, 0.05),
    convenienceFeePerSeat: rupeesToPaise(process.env.CONVENIENCE_FEE_PER_SEAT, 25),
  },
  reschedule: {
    cutoffHours: num(process.env.RESCHEDULE_CUTOFF_HOURS, 24),
    feePerSeat: rupeesToPaise(process.env.RESCHEDULE_FEE_PER_SEAT, 50),
    maxReschedules: num(process.env.MAX_RESCHEDULES, 2),
    quoteMinutes: 10,
  },
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: num(process.env.SMTP_PORT, 587),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'BusYatra <no-reply@busyatra.dev>',
  },
  salesforce: {
    clientId: process.env.SALESFORCE_CLIENT_ID || '',
    clientSecret: process.env.SALESFORCE_CLIENT_SECRET || '',
    instanceUrl: (process.env.SALESFORCE_INSTANCE_URL || '').replace(/\/$/, ''),
    tokenUrl: process.env.SALESFORCE_TOKEN_URL || '',
    apiVersion: process.env.SALESFORCE_API_VERSION || 'v61.0',
  },
  agentforce: parseAgentforce(process.env.AGENTFORCE_CONFIGURATION),
  agentActionApiKey: process.env.AGENT_ACTION_API_KEY || '',
};

export const salesforceConfigured = () =>
  Boolean(config.salesforce.clientId && config.salesforce.clientSecret && config.salesforce.tokenUrl);
export const smtpConfigured = () => Boolean(config.smtp.host);
