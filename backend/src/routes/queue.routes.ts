import { Router } from 'express';
import {
  createQueue,
  getQueue,
  getServiceQueues,
  joinQueue,
  callNext,
  markServed,
  cancelEntry,
  markNoShow,
  moveEntry,
  getWaitTime,
  updateQueueStatus,
  generateTicket,
} from '../controllers/queue.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { auditLog } from '../middleware/audit.middleware';

const router = Router();

router.use(authenticate);

// Queue management
router.post('/', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN', 'SERVICE_STAFF', 'RECEPTIONIST'), auditLog({ action: 'QUEUE_CREATED', resource: 'queue' }), createQueue);
router.get('/service/:serviceId', getServiceQueues);
router.get('/:id', getQueue);
router.patch('/:id/status', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN', 'SERVICE_STAFF'), auditLog({ action: 'QUEUE_STATUS_UPDATED', resource: 'queue' }), updateQueueStatus);

// Queue operations
router.post('/:id/join', auditLog({ action: 'QUEUE_JOIN', resource: 'queue' }), joinQueue);
router.post('/:id/call-next', authorize('SERVICE_STAFF', 'LOCATION_ADMIN', 'ORG_ADMIN', 'SUPER_ADMIN'), auditLog({ action: 'QUEUE_CALL_NEXT', resource: 'queue' }), callNext);
router.patch('/:id/entry/:entryId/serve', authorize('SERVICE_STAFF', 'LOCATION_ADMIN', 'ORG_ADMIN', 'SUPER_ADMIN'), auditLog({ action: 'ENTRY_SERVED', resource: 'queue_entry' }), markServed);
router.patch('/:id/entry/:entryId/cancel', auditLog({ action: 'ENTRY_CANCELLED', resource: 'queue_entry' }), cancelEntry);
router.patch('/:id/entry/:entryId/no-show', authorize('SERVICE_STAFF', 'LOCATION_ADMIN', 'ORG_ADMIN', 'SUPER_ADMIN'), auditLog({ action: 'ENTRY_NO_SHOW', resource: 'queue_entry' }), markNoShow);
router.patch('/:id/move', authorize('SERVICE_STAFF', 'RECEPTIONIST', 'LOCATION_ADMIN', 'ORG_ADMIN', 'SUPER_ADMIN'), auditLog({ action: 'ENTRY_MOVED', resource: 'queue_entry' }), moveEntry);

// Queue info
router.get('/:id/waittime', getWaitTime);
router.get('/:id/ticket/:entryId', generateTicket);

export default router;
