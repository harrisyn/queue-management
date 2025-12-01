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
} from '../controllers/user.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/me', getMe);
router.get('/', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN'), getUsers);
router.post('/', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN'), createUser);
router.get('/:id', getUser);
router.put('/:id', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN'), updateUser);
router.delete('/:id', authorize('SUPER_ADMIN', 'ORG_ADMIN'), deleteUser);

// Practitioner management
router.post('/practitioners', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN'), assignPractitioner);
router.delete('/practitioners/:userId/:serviceId', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN'), removePractitioner);

export default router;
