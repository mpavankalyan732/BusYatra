import { ZodError } from 'zod';
import { badRequest } from '../lib/errors.js';

/**
 * validate({ body, query, params }) — each a zod schema.
 * Parsed (coerced) values replace the originals; query is stored on req.validQuery
 * because Express exposes req.query as a getter.
 */
export const validate = (schemas) => (req, _res, next) => {
  try {
    if (schemas.body) req.body = schemas.body.parse(req.body ?? {});
    if (schemas.params) req.params = schemas.params.parse(req.params);
    if (schemas.query) req.validQuery = schemas.query.parse(req.query);
    next();
  } catch (err) {
    if (err instanceof ZodError) {
      const details = err.errors.map((e) => ({ path: e.path.join('.'), message: e.message }));
      return next(badRequest(details[0] ? `${details[0].path || 'request'}: ${details[0].message}` : 'Invalid request', details));
    }
    return next(err);
  }
};
