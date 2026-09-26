import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { scope, service, location } from '../middleware/tenantScope.middleware';
import { rateLimit } from '../middleware/rateLimit.middleware';
import { getAiStatus, updateAiSettings, askAi, listInsights, getForecast, getAlerts } from '../controllers/ai.controller';

// AI-assisted analytics (provider-agnostic - see services/ai).
const router = Router();

router.use(authenticate);

const STAFF = ['SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN', 'SERVICE_STAFF', 'RECEPTIONIST'];
const ADMINS = ['SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN'];

const askLimit = rateLimit({ name: 'ai-ask', windowSeconds: 60 * 60, max: 60 });

router.get('/status', authorize(...ADMINS), getAiStatus);
router.put('/settings', authorize('SUPER_ADMIN', 'ORG_ADMIN'), updateAiSettings);
router.post('/ask', authorize(...ADMINS), askLimit, scope(location('body.locationId')), askAi);
router.get('/insights', authorize(...ADMINS), listInsights);

// Statistical - no LLM involved, available to all staff.
router.get('/forecast/:serviceId', authorize(...STAFF), scope(service('params.serviceId')), getForecast);
router.get('/alerts', authorize(...STAFF), scope(location('query.locationId')), getAlerts);

export default router;
