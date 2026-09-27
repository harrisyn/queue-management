import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { scope, location, displayMedia, displayPlaylist, each } from '../middleware/tenantScope.middleware';
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
  getUploadConfig,
  getMediaEntitlement,
  listPlaylists,
  createPlaylist,
  updatePlaylist,
  deletePlaylist,
  setPlaylistItems,
  registerDirectUpload,
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
router.get('/upload-config', admins, getUploadConfig);
router.get('/entitlement', admins, getMediaEntitlement);
router.get('/playlists', admins, listPlaylists);
router.post('/playlists', admins, scope(location('body.locationId')), createPlaylist);
router.patch('/playlists/:id', admins, scope(displayPlaylist('params.id'), location('body.locationId')), updatePlaylist);
router.delete('/playlists/:id', admins, scope(displayPlaylist('params.id')), deletePlaylist);
router.put('/playlists/:id/items', admins, scope(displayPlaylist('params.id')), setPlaylistItems);
router.post('/media/direct', admins, scope(location('body.locationId')), registerDirectUpload);
router.put('/media/order', admins, scope(each('items', 'id', displayMedia)), reorderDisplayMedia);
router.patch('/media/:id', admins, scope(displayMedia('params.id'), location('body.locationId')), updateDisplayMedia);
router.delete('/media/:id', admins, scope(displayMedia('params.id')), deleteDisplayMedia);

export default router;
