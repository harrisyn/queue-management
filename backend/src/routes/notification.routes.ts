import { Router } from 'express';
import {
  sendNotification,
  getUserNotifications,
  markNotificationRead,
  markAllRead,
} from '../controllers/notification.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.post('/send', sendNotification);
router.get('/user/:userId', getUserNotifications);
router.patch('/:id/read', markNotificationRead);
router.patch('/user/:userId/read-all', markAllRead);

export default router;
