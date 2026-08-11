import { Router } from 'express';
import {
  getServicePoints,
  getServicePoint,
  createServicePoint,
  updateServicePoint,
  deleteServicePoint,
  getActiveServicePoints,
  getServicePointsForService,
  linkServicePointToService,
  unlinkServicePointFromService,
  activateServicePoint,
  vacateServicePoint,
  getOccupiedServicePoints,
  updateServicePointLink,
  // Instance management
  getServicePointInstances,
  syncServicePointInstances,
  activateServicePointInstance,
  vacateServicePointInstance,
  getLocationInstances,
  toggleInstanceActive,
  getServiceInstances,
} from '../controllers/servicepoint.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

// Service point management
router.get('/location/:locationId', getServicePoints);
router.get('/location/:locationId/active', getActiveServicePoints);
router.get('/location/:locationId/occupied', getOccupiedServicePoints);
router.get('/location/:locationId/instances', getLocationInstances);
router.get('/service/:serviceId', getServicePointsForService);
router.get('/service/:serviceId/instances', getServiceInstances);
router.get('/:id', getServicePoint);
router.post('/', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN'), createServicePoint);
router.patch('/:id', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN'), updateServicePoint);
router.delete('/:id', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN'), deleteServicePoint);

// Service point to service linking (admin)
router.post('/link', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN'), linkServicePointToService);
router.post('/unlink', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN'), unlinkServicePointFromService);
router.patch('/link/:linkId', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN'), updateServicePointLink);

// Activation (operator can activate/vacate their desk)
router.post('/activate', activateServicePoint);
router.post('/vacate', vacateServicePoint);

// Instance management
router.get('/:servicePointId/instances', getServicePointInstances);
router.post('/:servicePointId/instances/sync', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN'), syncServicePointInstances);
router.post('/instances/:instanceId/activate', activateServicePointInstance);
router.post('/instances/:instanceId/vacate', vacateServicePointInstance);
router.patch('/instances/:instanceId/toggle', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN'), toggleInstanceActive);

export default router;
