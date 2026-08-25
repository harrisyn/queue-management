import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import {
  listOrganizations,
  getOrganization,
  updateOrganizationSubscription,
  cancelOrganizationSubscription,
  grantCredits,
  deleteOrganization,
  listPlans,
  createPlan,
  updatePlan,
  deletePlan,
  getDashboardStats,
  getOrganizationUsage,
} from '../controllers/superadmin.controller';
import { listPaymentProviders, upsertPaymentProvider, testPaymentProvider } from '../controllers/paymentProvider.controller';
import { listAddOnPricing, updateAddOnPricing } from '../controllers/addOnPricing.controller';

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
router.post('/organizations/:id/credits/grant', grantCredits);
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

// Add-on pricing configuration
router.get('/addon-pricing', listAddOnPricing);
router.put('/addon-pricing/:resourceType', updateAddOnPricing);

export default router;
