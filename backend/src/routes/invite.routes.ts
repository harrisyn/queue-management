import { Router } from 'express';
import { createInvite, getInvite, listInvites } from '../controllers/invite.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.post('/', authorize('SUPER_ADMIN', 'ORG_ADMIN'), createInvite);
router.get('/', authorize('SUPER_ADMIN', 'ORG_ADMIN'), listInvites);
router.get('/:code', authorize('SUPER_ADMIN', 'ORG_ADMIN'), getInvite);

export default router;
