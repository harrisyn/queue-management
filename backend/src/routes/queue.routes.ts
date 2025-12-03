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
  reorderEntries,
  callNextWithServicePoint,
  getQueueEntriesForOperator,
  completeWithNextSuggestions,
} from '../controllers/queue.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

// Queue management
router.post('/', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN', 'SERVICE_STAFF', 'RECEPTIONIST'), createQueue);
router.get('/service/:serviceId', getServiceQueues);
router.get('/:id', getQueue);
router.get('/:id/operator', authorize('SERVICE_STAFF', 'LOCATION_ADMIN', 'ORG_ADMIN', 'SUPER_ADMIN', 'RECEPTIONIST'), getQueueEntriesForOperator);
router.patch('/:id/status', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN', 'SERVICE_STAFF'), updateQueueStatus);

// Queue operations
router.post('/:id/join', joinQueue);
router.post('/:id/call-next', authorize('SERVICE_STAFF', 'LOCATION_ADMIN', 'ORG_ADMIN', 'SUPER_ADMIN'), callNext);
router.post('/:id/call-next-sp', authorize('SERVICE_STAFF', 'LOCATION_ADMIN', 'ORG_ADMIN', 'SUPER_ADMIN', 'RECEPTIONIST'), callNextWithServicePoint);
router.patch('/:id/reorder', authorize('SERVICE_STAFF', 'RECEPTIONIST', 'LOCATION_ADMIN', 'ORG_ADMIN', 'SUPER_ADMIN'), reorderEntries);
router.patch('/:id/entry/:entryId/serve', authorize('SERVICE_STAFF', 'LOCATION_ADMIN', 'ORG_ADMIN', 'SUPER_ADMIN'), markServed);
router.patch('/:id/entry/:entryId/complete', authorize('SERVICE_STAFF', 'LOCATION_ADMIN', 'ORG_ADMIN', 'SUPER_ADMIN', 'RECEPTIONIST'), completeWithNextSuggestions);
router.patch('/:id/entry/:entryId/cancel', cancelEntry);
router.patch('/:id/entry/:entryId/no-show', authorize('SERVICE_STAFF', 'LOCATION_ADMIN', 'ORG_ADMIN', 'SUPER_ADMIN'), markNoShow);
router.patch('/:id/move', authorize('SERVICE_STAFF', 'RECEPTIONIST', 'LOCATION_ADMIN', 'ORG_ADMIN', 'SUPER_ADMIN'), moveEntry);

// Queue info
router.get('/:id/waittime', getWaitTime);
router.get('/:id/ticket/:entryId', generateTicket);

export default router;
