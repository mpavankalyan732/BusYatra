import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` } });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      success: false,
      error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
    });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, error: { code: 'BAD_JSON', message: 'Malformed JSON body' } });
  }
  logger.error({ err, path: req.path }, 'Unhandled error');
  return res.status(500).json({ success: false, error: { code: 'INTERNAL', message: 'Something went wrong' } });
}
