import { Router } from 'express';
import {
  sendNotification,
  getUserNotifications,
  markNotificationRead,
  markAllRead,
} from '../controllers/notification.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { scope, user, notification } from '../middleware/tenantScope.middleware';

const router = Router();

router.use(authenticate);

router.post('/send', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN', 'SERVICE_STAFF', 'RECEPTIONIST'), scope(user('body.userId')), sendNotification);
router.get('/user/:userId', scope(user('params.userId')), getUserNotifications);
router.patch('/:id/read', scope(notification('params.id')), markNotificationRead);
router.patch('/user/:userId/read-all', scope(user('params.userId')), markAllRead);

export default router;
