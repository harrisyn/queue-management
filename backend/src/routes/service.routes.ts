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

const router = Router();

router.use(authenticate);

router.post('/', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN'), createService);
// Nested under locations
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
