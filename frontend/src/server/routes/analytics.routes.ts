import { Router } from 'express';
import {
  getQueueMetrics,
  getServiceMetrics,
  getLocationMetrics,
  getFlowAnalytics,
  getPeakHoursAnalysis,
  getDetailedLocationMetrics,
  getJourneyAnalytics,
} from '../controllers/analytics.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { scope, queue, service, location } from '../middleware/tenantScope.middleware';

const router = Router();

router.use(authenticate);
router.use(authorize('SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN'));

router.get('/queue/:id', scope(queue('params.id')), getQueueMetrics);
router.get('/service/:serviceId', scope(service('params.serviceId')), getServiceMetrics);
router.get('/location/:locationId', scope(location('params.locationId')), getLocationMetrics);
router.get('/location/:locationId/detailed', scope(location('params.locationId')), getDetailedLocationMetrics);
router.get('/location/:locationId/journeys', scope(location('params.locationId')), getJourneyAnalytics);
router.get('/location/:locationId/flows', scope(location('params.locationId')), getFlowAnalytics);
router.get('/service/:serviceId/peak-hours', scope(service('params.serviceId')), getPeakHoursAnalysis);

export default router;
