import { Router } from 'express';
import {
  createLocation,
  getLocations,
  getLocation,
  updateLocation,
  deleteLocation,
} from '../controllers/location.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { scope, org, location } from '../middleware/tenantScope.middleware';
import { enforceLimit } from '../middleware/subscription.middleware';

const router = Router();

router.use(authenticate);

// Nested under organizations
router.post('/orgs/:organizationId/locations', authorize('SUPER_ADMIN', 'ORG_ADMIN'), scope(org('params.organizationId')), enforceLimit('locations'), createLocation);
router.get('/orgs/:organizationId/locations', scope(org('params.organizationId')), getLocations);

// Direct location access
router.get('/:id', scope(location('params.id')), getLocation);
router.put('/:id', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN'), scope(location('params.id')), updateLocation);
router.delete('/:id', authorize('SUPER_ADMIN', 'ORG_ADMIN'), scope(location('params.id')), deleteLocation);

export default router;
