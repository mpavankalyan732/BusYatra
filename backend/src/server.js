import { createApp } from './app.js';
import { config, salesforceConfigured, smtpConfigured } from './config/env.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';
import { startScheduler } from './jobs/scheduler.js';

const app = createApp();
const server = app.listen(config.port, () => {
  logger.info(`BusYatra API listening on :${config.port} (${config.nodeEnv})`);
  logger.info(
    `Integrations - SMTP: ${smtpConfigured() ? 'on' : 'dev-log'} | Salesforce: ${salesforceConfigured() ? 'on' : 'off'} | ` +
      `Agent: ${config.agentforce ? 'Agentforce' : 'MOCK (not Agentforce)'} | Payments: demo simulator`,
  );
});

const stopJobs = process.env.DISABLE_JOBS === 'true' ? () => {} : startScheduler();

async function shutdown(signal) {
  logger.info(`${signal} received, shutting down`);
  stopJobs();
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
