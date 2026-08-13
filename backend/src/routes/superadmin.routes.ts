import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import {
  listOrganizations,
  getOrganization,
  updateOrganizationSubscription,
  cancelOrganizationSubscription,
  deleteOrganization,
  listPlans,
  createPlan,
  updatePlan,
  deletePlan,
  getDashboardStats,
  getOrganizationUsage,
} from '../controllers/superadmin.controller';
import { listPaymentProviders, upsertPaymentProvider, testPaymentProvider } from '../controllers/paymentProvider.controller';

const router = Router();

// All superadmin routes require SUPER_ADMIN role
router.use(authenticate);
router.use(authorize('SUPER_ADMIN'));

// Dashboard
router.get('/dashboard', getDashboardStats);

// Organization management
router.get('/organizations', listOrganizations);
router.get('/organizations/:id', getOrganization);
router.get('/organizations/:id/usage', getOrganizationUsage);
router.patch('/organizations/:id/subscription', updateOrganizationSubscription);
router.post('/organizations/:id/cancel', cancelOrganizationSubscription);
router.delete('/organizations/:id', deleteOrganization);

// Subscription plan management
router.get('/plans', listPlans);
router.post('/plans', createPlan);
router.patch('/plans/:id', updatePlan);
router.delete('/plans/:id', deletePlan);

// Payment provider configuration
router.get('/payment-providers', listPaymentProviders);
router.put('/payment-providers/:provider', upsertPaymentProvider);
router.post('/payment-providers/:provider/test', testPaymentProvider);

export default router;
