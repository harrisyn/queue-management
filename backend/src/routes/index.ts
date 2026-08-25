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
import servicepointRoutes from './servicepoint.routes';
import serviceflowRoutes from './serviceflow.routes';
import datasourceRoutes from './datasource.routes';
import superadminRoutes from './superadmin.routes';

const router = Router();

router.use('/auth', authRoutes);

// Public endpoints (no auth required)
router.get('/public/locations', (req, res, next) => {
	const { getPublicLocations } = require('../controllers/location.controller');
	return getPublicLocations(req, res, next as any);
});
router.get('/public/locations/:code', (req, res, next) => {
	const { getLocationByCode } = require('../controllers/location.controller');
	return getLocationByCode(req, res, next as any);
});
router.post('/public/join', (req, res, next) => {
	const { publicJoinQueueWithSession } = require('../controllers/queue.controller');
	return publicJoinQueueWithSession(req, res, next as any);
});
router.get('/public/status/:queueId/:entryId', (req, res, next) => {
	const { getPublicStatus } = require('../controllers/queue.controller');
	return getPublicStatus(req, res, next as any);
});
router.get('/public/session/:sessionId/tickets', (req, res, next) => {
	const { getSessionTickets } = require('../controllers/queue.controller');
	return getSessionTickets(req, res, next as any);
});
router.get('/public/display/:locationId', (req, res, next) => {
	const { getActiveServicePoints } = require('../controllers/servicepoint.controller');
	return getActiveServicePoints(req, res, next as any);
});
router.get('/public/location-info/:locationId', (req, res, next) => {
	const { getPublicLocationInfo } = require('../controllers/location.controller');
	return getPublicLocationInfo(req, res, next as any);
});
router.get('/public/queues/:locationId', (req, res, next) => {
	const { getLocationQueues } = require('../controllers/queue.controller');
	return getLocationQueues(req, res, next as any);
});
router.post('/public/register-org', (req, res, next) => {
	const { registerOrganization } = require('../controllers/organization.controller');
	return registerOrganization(req, res, next as any);
});
router.patch('/public/entries/:entryId/identity', (req, res, next) => {
	const { updatePublicEntryIdentity } = require('../controllers/queue.controller');
	return updatePublicEntryIdentity(req, res, next as any);
});
router.get('/public/entries/:entryId/identity', (req, res, next) => {
	const { getPublicEntryIdentity } = require('../controllers/queue.controller');
	return getPublicEntryIdentity(req, res, next as any);
});
router.get('/public/orgs/by-slug/:slug', (req, res, next) => {
	const { getPublicOrganizationBySlug } = require('../controllers/organization.controller');
	return getPublicOrganizationBySlug(req, res, next as any);
});
router.get('/public/orgs/:orgId', (req, res, next) => {
	const { getPublicOrganization } = require('../controllers/organization.controller');
	return getPublicOrganization(req, res, next as any);
});
router.get('/public/orgs/:orgId/locations/:locationId/services', (req, res, next) => {
	const { getPublicLocationServices } = require('../controllers/service.controller');
	return getPublicLocationServices(req, res, next as any);
});

// OTP Verification endpoints
router.post('/public/send-otp', (req, res, next) => {
	const { sendOTP } = require('../controllers/auth.controller');
	return sendOTP(req, res, next as any);
});
router.post('/public/verify-otp', (req, res, next) => {
	const { verifyOTPCode } = require('../controllers/auth.controller');
	return verifyOTPCode(req, res, next as any);
});

// Subscription info endpoint (requires auth)
import { authenticate } from '../middleware/auth.middleware';
import { getMySubscription } from '../middleware/subscription.middleware';
import { createCheckoutSession, switchToFreePlan } from '../controllers/subscriptionCheckout.controller';
import { createAddOnCheckout, listMyAddOns, cancelAddOn } from '../controllers/addOnCheckout.controller';
import { listAddOnPricing } from '../controllers/addOnPricing.controller';
import { listPlans } from '../controllers/superadmin.controller';
router.get('/subscription', authenticate, getMySubscription);
router.post('/tenant/subscription/checkout', authenticate, createCheckoutSession);
router.post('/tenant/subscription/switch/:planId', authenticate, switchToFreePlan);
router.post('/tenant/addons/checkout', authenticate, createAddOnCheckout);
router.get('/tenant/addons', authenticate, listMyAddOns);
router.delete('/tenant/addons/:id', authenticate, cancelAddOn);
// Read-only pricing for any authenticated user - tenants need this to render
// the purchase UI. Reuses the superadmin controller's listAddOnPricing.
router.get('/tenant/addon-pricing', authenticate, listAddOnPricing);
// Read-only plan listing for any authenticated user (not superadmin-only —
// tenants need this to render the pricing page). Reuses the superadmin
// controller's listPlans, which only reads SubscriptionPlan rows.
router.get('/plans', authenticate, listPlans);

router.use('/orgs', organizationRoutes);
router.use('/locations', locationRoutes);
router.use('/invites', inviteRoutes);
router.use('/services', serviceRoutes);
router.use('/service-points', servicepointRoutes);
router.use('/service-flows', serviceflowRoutes);
router.use('/', datasourceRoutes);
router.use('/queues', queueRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/notifications', notificationRoutes);
router.use('/users', userRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/superadmin', superadminRoutes);

export default router;
