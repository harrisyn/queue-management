import { Router } from 'express';
import {
  createService,
  getServices,
  getService,
  getServiceSchedule,
  updateService,
  deleteService,
  createServiceFlow,
  getServiceFlows,
} from '../controllers/service.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { enforceLimit } from '../middleware/subscription.middleware';

const router = Router();

router.use(authenticate);

// Nested under locations
router.post('/locations/:locationId/services', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN'), enforceLimit('services'), createService);
router.get('/locations/:locationId/services', getServices);

// Direct service access
router.get('/:id', getService);
router.get('/:id/schedule', getServiceSchedule);
router.put('/:id', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN'), updateService);
router.delete('/:id', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN'), deleteService);

// Service flows
router.post('/flows', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN'), createServiceFlow);
router.get('/:serviceId/flows', getServiceFlows);

export default router;
