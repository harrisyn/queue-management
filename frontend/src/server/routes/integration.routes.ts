import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { scope, org, webhookEndpoint } from '../middleware/tenantScope.middleware';
import {
  listWebhookEvents,
  listWebhooks,
  createWebhook,
  updateWebhook,
  rotateWebhookSecret,
  deleteWebhook,
  testWebhook,
  listWebhookDeliveries,
  listAuditLogs,
} from '../controllers/integration.controller';

const router = Router();

const admins = [authenticate, authorize('SUPER_ADMIN', 'ORG_ADMIN')];
const ownOrg = scope(org('params.organizationId'));
const ownHook = scope(webhookEndpoint('params.id'));

// Mounted at '/', so every route carries its own auth (a router-level
// use() here would apply to every other router mounted at '/').
router.get('/webhook-events', ...admins, listWebhookEvents);
router.get('/orgs/:organizationId/webhooks', ...admins, ownOrg, listWebhooks);
router.post('/orgs/:organizationId/webhooks', ...admins, ownOrg, createWebhook);
router.patch('/webhooks/:id', ...admins, ownHook, updateWebhook);
router.post('/webhooks/:id/rotate-secret', ...admins, ownHook, rotateWebhookSecret);
router.post('/webhooks/:id/test', ...admins, ownHook, testWebhook);
router.get('/webhooks/:id/deliveries', ...admins, ownHook, listWebhookDeliveries);
router.delete('/webhooks/:id', ...admins, ownHook, deleteWebhook);

router.get('/orgs/:organizationId/audit-logs', ...admins, ownOrg, listAuditLogs);

export default router;
