import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { register, login, refreshToken, logout } from '../controllers/auth.controller';
import { auditLog } from '../middleware/audit.middleware';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again later.' },
});

router.post('/register', authLimiter, auditLog({ action: 'REGISTER', resource: 'user' }), register);
router.post('/login', authLimiter, auditLog({ action: 'LOGIN', resource: 'auth' }), login);
router.post('/refresh', auditLog({ action: 'TOKEN_REFRESH', resource: 'auth' }), refreshToken);
router.post('/logout', auditLog({ action: 'LOGOUT', resource: 'auth' }), logout);

export default router;
