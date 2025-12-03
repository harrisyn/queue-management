import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import {
  getDataSources,
  getDataSource,
  createDataSource,
  updateDataSource,
  deleteDataSource,
  testDataSource,
  getFieldMappings,
  createFieldMapping,
  updateFieldMapping,
  deleteFieldMapping,
  fetchFromDataSource,
} from '../controllers/datasource.controller';

const router = Router();

// All routes require authentication and admin role
router.use(authenticate);

// Data source routes mounted under /orgs/:organizationId/data-sources
router.get('/orgs/:organizationId/data-sources', authorize('ORG_ADMIN', 'SUPER_ADMIN'), getDataSources);
router.post('/orgs/:organizationId/data-sources', authorize('ORG_ADMIN', 'SUPER_ADMIN'), createDataSource);

// Individual data source routes
router.get('/data-sources/:id', authorize('ORG_ADMIN', 'SUPER_ADMIN'), getDataSource);
router.put('/data-sources/:id', authorize('ORG_ADMIN', 'SUPER_ADMIN'), updateDataSource);
router.delete('/data-sources/:id', authorize('ORG_ADMIN', 'SUPER_ADMIN'), deleteDataSource);
router.post('/data-sources/:id/test', authorize('ORG_ADMIN', 'SUPER_ADMIN'), testDataSource);
router.post('/data-sources/:id/fetch', authorize('ORG_ADMIN', 'SUPER_ADMIN', 'LOCATION_ADMIN', 'SERVICE_STAFF', 'RECEPTIONIST'), fetchFromDataSource);

// Field mapping routes
router.get('/data-sources/:dataSourceId/mappings', authorize('ORG_ADMIN', 'SUPER_ADMIN'), getFieldMappings);
router.post('/data-sources/:dataSourceId/mappings', authorize('ORG_ADMIN', 'SUPER_ADMIN'), createFieldMapping);
router.put('/field-mappings/:id', authorize('ORG_ADMIN', 'SUPER_ADMIN'), updateFieldMapping);
router.delete('/field-mappings/:id', authorize('ORG_ADMIN', 'SUPER_ADMIN'), deleteFieldMapping);

export default router;
