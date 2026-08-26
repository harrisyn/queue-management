import { Router } from 'express';
import {
  createOrganization,
  getOrganizations,
  getOrganization,
  updateOrganization,
  deleteOrganization,
  uploadOrganizationLogo,
  logoUploadMiddleware,
} from '../controllers/organization.controller';
import { authenticate, authorize, requireOwnOrganization } from '../middleware/auth.middleware';
import { loadSubscription, requireFeature } from '../middleware/subscription.middleware';

const router = Router();

router.use(authenticate);

router.post('/', authorize('SUPER_ADMIN'), createOrganization);
router.get('/', authorize('SUPER_ADMIN', 'ORG_ADMIN'), getOrganizations);
router.get('/:id', requireOwnOrganization, getOrganization);
router.put('/:id', authorize('SUPER_ADMIN', 'ORG_ADMIN'), requireOwnOrganization, updateOrganization);
router.post(
  '/:id/logo',
  authorize('SUPER_ADMIN', 'ORG_ADMIN'),
  requireOwnOrganization,
  loadSubscription,
  requireFeature('customBranding'),
  logoUploadMiddleware,
  uploadOrganizationLogo
);
router.delete('/:id', authorize('SUPER_ADMIN'), deleteOrganization);

export default router;
