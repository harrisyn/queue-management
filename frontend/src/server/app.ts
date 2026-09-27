import express, { Application } from 'express';
import cors from 'cors';
import routes from './routes';
import { errorHandler } from './middleware/error.middleware';
import { handleStripeWebhook, handlePaystackWebhook } from './controllers/paymentWebhook.controller';
import { corsOrigin } from './lib/cors';
import { getJwtSecret } from './lib/jwt';
import { realtimeRequestScope } from './lib/realtime';

/**
 * The API as an Express app. It no longer listens on its own port: Next.js
 * serves it from src/pages/api/v1/[...path].ts, so the web app and API ship
 * as one deployment (Vercel, or `next start` in a container).
 */
function createApp(): Application {
  // Fail fast on a missing/default JWT secret in production rather than on
  // the first login.
  getJwtSecret();

  const app = express();
  // Behind a proxy/load balancer (Vercel, nginx), so req.ip is the real client
  // IP from X-Forwarded-For - rate limiting keys on it.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // Real-time events raised while handling a request are flushed before the
  // response ends (serverless functions may freeze right after).
  app.use(realtimeRequestScope);

  // Webhook routes need the raw body for signature verification, so they're
  // registered before express.json() runs (which would otherwise consume and
  // parse the body, leaving nothing for verifyWebhookSignature to check).
  app.post('/api/v1/webhooks/stripe', express.raw({ type: 'application/json' }), handleStripeWebhook);
  app.post('/api/v1/webhooks/paystack', express.raw({ type: 'application/json' }), handlePaystackWebhook);

  app.use(cors({ origin: corsOrigin, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  app.get('/api/v1/health', (_req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString(), version: '2.0.0' });
  });

  app.use('/api/v1', routes);

  app.use('/api/v1', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.use(errorHandler);
  return app;
}

// One instance per module load (per server process / warm serverless
// instance). Deliberately not cached on globalThis: in development that kept
// serving the old route table after hot reloads.
export const app: Application = createApp();

export default app;
