import { Router } from 'express';
import {
  getQueueMetrics,
  getServiceMetrics,
  getLocationMetrics,
  getFlowAnalytics,
  getPeakHoursAnalysis,
} from '../controllers/analytics.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);
router.use(authorize('SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN'));

router.get('/queue/:id', getQueueMetrics);
router.get('/service/:serviceId', getServiceMetrics);
router.get('/location/:locationId', getLocationMetrics);
router.get('/location/:locationId/flows', getFlowAnalytics);
router.get('/service/:serviceId/peak-hours', getPeakHoursAnalysis);

export default router;
