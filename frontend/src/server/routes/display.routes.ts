import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { scope, location, displayMedia, each } from '../middleware/tenantScope.middleware';
import {
  getDisplayConfig,
  updateDisplayConfig,
  listDisplayMedia,
  createDisplayMedia,
  uploadDisplayMedia,
  mediaUploadMiddleware,
  updateDisplayMedia,
  reorderDisplayMedia,
  deleteDisplayMedia,
} from '../controllers/display.controller';

const router = Router();
const admins = authorize('SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN');

router.use(authenticate);

router.get('/locations/:locationId/config', admins, scope(location('params.locationId')), getDisplayConfig);
router.put('/locations/:locationId/config', admins, scope(location('params.locationId')), updateDisplayConfig);

router.get('/media', admins, listDisplayMedia);
router.post('/media', admins, scope(location('body.locationId')), createDisplayMedia);
// multer runs first so the multipart fields (locationId) exist for scope().
router.post('/media/upload', admins, mediaUploadMiddleware, scope(location('body.locationId')), uploadDisplayMedia);
router.put('/media/order', admins, scope(each('items', 'id', displayMedia)), reorderDisplayMedia);
router.patch('/media/:id', admins, scope(displayMedia('params.id'), location('body.locationId')), updateDisplayMedia);
router.delete('/media/:id', admins, scope(displayMedia('params.id')), deleteDisplayMedia);

export default router;
