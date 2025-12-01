import { Router } from 'express';
import {
  createAppointment,
  getAppointments,
  getAppointment,
  getUserAppointments,
  rescheduleAppointment,
  cancelAppointment,
  checkInAppointment,
  getAvailableSlots,
} from '../controllers/appointment.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

// Appointment CRUD
router.post('/', createAppointment);
router.get('/', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN', 'SERVICE_STAFF', 'RECEPTIONIST'), getAppointments);
router.get('/:id', getAppointment);
router.get('/user/:userId', getUserAppointments);

// Appointment operations
router.patch('/:id/reschedule', rescheduleAppointment);
router.patch('/:id/cancel', cancelAppointment);
router.post('/:id/check-in', authorize('SERVICE_STAFF', 'RECEPTIONIST', 'LOCATION_ADMIN', 'ORG_ADMIN', 'SUPER_ADMIN'), checkInAppointment);

// Available slots
router.get('/service/:serviceId/slots', getAvailableSlots);

export default router;
