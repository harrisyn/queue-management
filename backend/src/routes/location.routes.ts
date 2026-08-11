import { Router } from 'express';
import {
  createLocation,
  getLocations,
  getLocation,
  updateLocation,
  deleteLocation,
} from '../controllers/location.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { enforceLimit } from '../middleware/subscription.middleware';

const router = Router();

router.use(authenticate);

// Nested under organizations
router.post('/orgs/:organizationId/locations', authorize('SUPER_ADMIN', 'ORG_ADMIN'), enforceLimit('locations'), createLocation);
router.get('/orgs/:organizationId/locations', getLocations);

// Direct location access
router.get('/:id', getLocation);
router.put('/:id', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN'), updateLocation);
router.delete('/:id', authorize('SUPER_ADMIN', 'ORG_ADMIN'), deleteLocation);

export default router;
