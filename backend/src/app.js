import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { config } from './config/env.js';
import { logger } from './lib/logger.js';
import routes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1); // Render sits behind a proxy (needed for rate limiting by IP)
  app.disable('x-powered-by');

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  const origins = [config.frontendUrl, ...config.corsOrigins];
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || origins.includes(origin) || (!config.isProd && /^http:\/\/localhost:\d+$/.test(origin))),
      exposedHeaders: ['Content-Disposition'],
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === '/api/health' },
      serializers: { req: (req) => ({ method: req.method, url: req.url }) }, // never log bodies (payment data)
    }),
  );

  app.get('/', (_req, res) => res.json({ name: 'BusYatra API', docs: '/api/health' }));
  app.use('/api', routes);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
