import { Router } from 'express';
import {
  getLocationFlows,
  getServiceFlows,
  createServiceFlow,
  updateServiceFlow,
  deleteServiceFlow,
  updateFlowOrder,
  getNextServices,
} from '../controllers/serviceflow.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { scope, location, service, serviceFlow, each } from '../middleware/tenantScope.middleware';

const router = Router();

router.use(authenticate);

// Flow management
router.get('/location/:locationId', scope(location('params.locationId')), getLocationFlows);
router.get('/service/:serviceId', scope(service('params.serviceId')), getServiceFlows);
router.get('/service/:serviceId/next', scope(service('params.serviceId')), getNextServices);
router.post('/', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN'), scope(service('body.fromServiceId'), service('body.toServiceId')), createServiceFlow);
router.patch('/order', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN'), scope(each('flows', 'id', serviceFlow)), updateFlowOrder);
router.patch('/:id', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN'), scope(serviceFlow('params.id')), updateServiceFlow);
router.delete('/:id', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN'), scope(serviceFlow('params.id')), deleteServiceFlow);

export default router;
