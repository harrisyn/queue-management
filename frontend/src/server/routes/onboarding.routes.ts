import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { getOnboardingStatus, quickStart } from '../controllers/onboarding.controller';

const router = Router();

router.use(authenticate);
router.get('/status', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN'), getOnboardingStatus);
router.post('/quick-start', authorize('SUPER_ADMIN', 'ORG_ADMIN'), quickStart);

export default router;
