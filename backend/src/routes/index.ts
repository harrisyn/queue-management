import { Router } from 'express';
import authRoutes from './auth.routes';
import organizationRoutes from './organization.routes';
import locationRoutes from './location.routes';
import serviceRoutes from './service.routes';
import queueRoutes from './queue.routes';
import appointmentRoutes from './appointment.routes';
import notificationRoutes from './notification.routes';
import userRoutes from './user.routes';
import analyticsRoutes from './analytics.routes';
import inviteRoutes from './invite.routes';

const router = Router();

router.use('/auth', authRoutes);
// Public endpoints (no auth)
router.get('/public/locations', (req, res, next) => {
	// lazy import to avoid circular deps
	const { getPublicLocations } = require('../controllers/location.controller');
	return getPublicLocations(req, res, next as any);
});
router.use('/orgs', organizationRoutes);
router.use('/locations', locationRoutes);
router.use('/invites', inviteRoutes);
router.use('/services', serviceRoutes);
router.use('/queues', queueRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/notifications', notificationRoutes);
router.use('/users', userRoutes);
router.use('/analytics', analyticsRoutes);

export default router;
