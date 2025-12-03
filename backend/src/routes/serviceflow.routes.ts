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

const router = Router();

router.use(authenticate);

// Flow management
router.get('/location/:locationId', getLocationFlows);
router.get('/service/:serviceId', getServiceFlows);
router.get('/service/:serviceId/next', getNextServices);
router.post('/', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN'), createServiceFlow);
router.patch('/order', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN'), updateFlowOrder);
router.patch('/:id', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN'), updateServiceFlow);
router.delete('/:id', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN'), deleteServiceFlow);

export default router;
