import { Router } from 'express';
import { register, login, refreshToken, logout } from '../controllers/auth.controller';
import { auditLog } from '../middleware/audit.middleware';
import { authLimiter } from '../middleware/rateLimiter';

const router = Router();

router.post('/register', authLimiter, auditLog({ action: 'REGISTER', resource: 'user' }, { logFailures: true }), register);
router.post('/login', authLimiter, auditLog({ action: 'LOGIN', resource: 'auth' }, { logFailures: true }), login);
router.post('/refresh', authLimiter, auditLog({ action: 'TOKEN_REFRESH', resource: 'auth' }, { logFailures: true }), refreshToken);
router.post('/logout', auditLog({ action: 'LOGOUT', resource: 'auth' }), logout);

export default router;
