import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { forbidden, unauthorized } from '../lib/errors.js';
import { safeEqual } from '../lib/util.js';

export const signUserToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role, email: user.email, name: user.name, scope: 'user' }, config.jwtSecret, {
    expiresIn: '7d',
  });

function readBearer(req) {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

/** Attaches req.user if a valid user JWT is present; never rejects. */
export function optionalAuth(req, _res, next) {
  const token = readBearer(req);
  if (token) {
    try {
      const p = jwt.verify(token, config.jwtSecret);
      if (p.scope === 'user') req.user = { id: p.sub, role: p.role, email: p.email, name: p.name };
    } catch {
      /* ignore invalid token for optional auth */
    }
  }
  next();
}

export function requireAuth(req, res, next) {
  optionalAuth(req, res, () => (req.user ? next() : next(unauthorized())));
}

export const requireRole = (...roles) => (req, res, next) =>
  requireAuth(req, res, (err) => {
    if (err) return next(err);
    return roles.includes(req.user.role) ? next() : next(forbidden('Admin access required'));
  });

/** Salesforce -> backend action calls (Apex via Named Credential) */
export function requireAgentApiKey(req, _res, next) {
  const key = req.headers['x-agent-api-key'];
  if (!config.agentActionApiKey || !safeEqual(String(key || ''), config.agentActionApiKey)) {
    return next(unauthorized('Invalid agent action API key'));
  }
  return next();
}

/** Short-lived token proving a customer verified ownership of one booking (email OTP). */
export const signRescheduleToken = (bookingId, bookingCode) =>
  jwt.sign({ sub: bookingId, bookingCode, scope: 'reschedule' }, config.jwtSecret, { expiresIn: '30m' });

export function verifyRescheduleToken(token) {
  if (!token) return null;
  try {
    const p = jwt.verify(String(token), config.jwtSecret);
    return p.scope === 'reschedule' ? { bookingId: p.sub, bookingCode: p.bookingCode } : null;
  } catch {
    return null;
  }
}
