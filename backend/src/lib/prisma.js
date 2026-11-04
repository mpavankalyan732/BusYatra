import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  // Errors are surfaced through our own handlers (e.g. expected unique-constraint races), so only warn by default.
  log: process.env.PRISMA_LOG ? ['query', 'warn', 'error'] : ['warn'],
});
