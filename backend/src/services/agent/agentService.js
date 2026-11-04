/**
 * Chooses the conversational provider:
 *   - AGENTFORCE when AGENTFORCE_CONFIGURATION is set (real Salesforce Agentforce)
 *   - MOCK_AGENT otherwise (clearly labelled; never presented as Agentforce)
 * Sessions are persisted so the API is stateless across instances.
 */
import { prisma } from '../../lib/prisma.js';
import { config } from '../../config/env.js';
import { forbidden, gone, notFound } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { agentforceProvider } from './agentforceProvider.js';
import { mockAgentProvider } from './mockAgentProvider.js';

const SESSION_TTL_MS = 30 * 60 * 1000;
const providerFor = (name) => (name === 'AGENTFORCE' ? agentforceProvider : mockAgentProvider);
const describe = (p) => ({ name: p.name, label: p.label, isMock: p.isMock });

export const activeProvider = () => (config.agentforce ? agentforceProvider : mockAgentProvider);

export async function startSession({ bookingId, bookingCode, verificationToken }) {
  const provider = activeProvider();
  const session = await prisma.agentSession.create({
    data: { bookingId, provider: provider.name, expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
  });
  try {
    const out = await provider.start(session, { verificationToken, bookingCode });
    await prisma.agentSession.update({
      where: { id: session.id },
      data: { state: out.state ?? undefined, providerSessionId: out.providerSessionId, sequenceId: out.sequenceId ?? 0 },
    });
    return { sessionId: session.id, provider: describe(provider), messages: out.messages };
  } catch (err) {
    logger.error({ err: err.message }, 'Agent session start failed');
    await prisma.agentSession.delete({ where: { id: session.id } }).catch(() => {});
    throw err;
  }
}

export async function sendMessage({ sessionId, bookingId, text }) {
  const session = await prisma.agentSession.findUnique({ where: { id: sessionId } });
  if (!session) throw notFound('Chat session not found');
  if (session.bookingId !== bookingId) throw forbidden('Chat session belongs to another booking');
  if (session.expiresAt < new Date()) throw gone('SESSION_EXPIRED', 'This chat session has expired. Please start again.');

  const provider = providerFor(session.provider);
  const out = await provider.message(session, text);
  await prisma.agentSession.update({
    where: { id: session.id },
    data: {
      state: out.state ?? undefined,
      sequenceId: out.sequenceId ?? session.sequenceId,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  });
  return { sessionId, provider: describe(provider), messages: out.messages };
}

export async function endSession({ sessionId, bookingId }) {
  const session = await prisma.agentSession.findUnique({ where: { id: sessionId } });
  if (!session || session.bookingId !== bookingId) return;
  await providerFor(session.provider).end(session);
  await prisma.agentSession.update({ where: { id: sessionId }, data: { expiresAt: new Date() } });
}
