import { Router } from 'express';
import {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  getMe,
  assignPractitioner,
  removePractitioner,
  updateUserIdentity,
} from '../controllers/user.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { scope, user, service } from '../middleware/tenantScope.middleware';

const router = Router();

router.use(authenticate);

router.get('/me', getMe);
router.get('/', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN'), getUsers);
router.post('/', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN'), createUser);
router.get('/:id', scope(user('params.id')), getUser);
router.put('/:id', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN'), scope(user('params.id')), updateUser);
router.put('/:id/identity', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN', 'SERVICE_STAFF', 'RECEPTIONIST'), scope(user('params.id')), updateUserIdentity);
router.delete('/:id', authorize('SUPER_ADMIN', 'ORG_ADMIN'), scope(user('params.id')), deleteUser);

// Practitioner management
router.post('/practitioners', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN'), scope(user('body.userId'), service('body.serviceId')), assignPractitioner);
router.delete('/practitioners/:userId/:serviceId', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN'), scope(user('params.userId'), service('params.serviceId')), removePractitioner);

export default router;
