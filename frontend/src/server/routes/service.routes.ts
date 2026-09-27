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
import { scope, location, service } from '../middleware/tenantScope.middleware';

const router = Router();

router.use(authenticate);

router.post('/', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN'), createService);
// Nested under locations
router.get('/locations/:locationId/services', scope(location('params.locationId')), getServices);

// Direct service access
router.get('/:id', scope(service('params.id')), getService);
router.get('/:id/schedule', scope(service('params.id')), getServiceSchedule);
router.put('/:id', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN'), scope(service('params.id')), updateService);
router.delete('/:id', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN'), scope(service('params.id')), deleteService);

// Service flows
router.post('/flows', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN'), scope(service('body.fromServiceId'), service('body.toServiceId')), createServiceFlow);
router.get('/:serviceId/flows', scope(service('params.serviceId')), getServiceFlows);

export default router;
