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
  activateServicePointInstance,
  vacateServicePointInstance,
  getLocationInstances,
  toggleInstanceActive,
  getServiceInstances,
} from '../controllers/servicepoint.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { scope, org, location, service, servicePoint, servicePointLink, instance } from '../middleware/tenantScope.middleware';

const router = Router();
const sp = servicePoint('body.servicePointId');
const svc = service('body.serviceId');
const inst = instance('params.instanceId');

router.use(authenticate);

// Service point definitions (org-level)
router.get('/organization/:organizationId', scope(org('params.organizationId')), getServicePoints);
router.get('/location/:locationId/active', scope(location('params.locationId')), getActiveServicePoints);
router.get('/location/:locationId/occupied', scope(location('params.locationId')), getOccupiedServicePoints);
router.get('/location/:locationId/instances', scope(location('params.locationId')), getLocationInstances);
router.get('/service/:serviceId', scope(service('params.serviceId')), getServicePointsForService);
router.get('/service/:serviceId/instances', scope(service('params.serviceId')), getServiceInstances);
router.get('/:id', scope(servicePoint('params.id')), getServicePoint);
router.post('/', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN'), scope(org('body.organizationId')), createServicePoint);
router.patch('/:id', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN'), scope(servicePoint('params.id')), updateServicePoint);
router.delete('/:id', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN'), scope(servicePoint('params.id')), deleteServicePoint);

// Service point to service linking (admin)
router.post('/link', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN'), scope(sp, svc), linkServicePointToService);
router.post('/unlink', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN'), scope(sp, svc), unlinkServicePointFromService);
router.patch('/link/:linkId', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN'), scope(servicePointLink('params.linkId')), updateServicePointLink);

// Activation (operator can activate/vacate their desk) - legacy link-level path
router.post('/activate', scope(sp, svc), activateServicePoint);
router.post('/vacate', scope(sp, svc), vacateServicePoint);

// Instance management
router.get('/:servicePointId/instances', scope(servicePoint('params.servicePointId')), getServicePointInstances);
router.post('/instances/:instanceId/activate', scope(inst), activateServicePointInstance);
router.post('/instances/:instanceId/vacate', scope(inst), vacateServicePointInstance);
router.patch('/instances/:instanceId/toggle', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN'), scope(inst), toggleInstanceActive);

export default router;
