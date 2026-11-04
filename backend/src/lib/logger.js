import pino from 'pino';
import { config } from '../config/env.js';

let transport;
if (!config.isProd) {
  try {
    await import('pino-pretty');
    transport = { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } };
  } catch {
    // pino-pretty is a dev dependency; plain JSON logs otherwise
  }
}

export const logger = pino({
  level: process.env.LOG_LEVEL || (config.isProd ? 'info' : 'debug'),
  // Defence in depth: payment instrument data and secrets must never reach the logs.
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers["x-access-token"]',
      'req.headers["x-agent-api-key"]',
      '*.cardNumber',
      '*.cvv',
      '*.password',
      '*.accessToken',
      '*.otp',
    ],
    censor: '[REDACTED]',
  },
  transport,
});
