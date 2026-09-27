import { Router } from 'express';
import { register, login, forgotPassword, resetPassword } from '../controllers/auth.controller';
import { limits } from '../middleware/rateLimit.middleware';

const router = Router();

router.post('/register', limits.registerOrg, register);
router.post('/login', limits.login, login);
router.post('/forgot-password', limits.sendCode, forgotPassword);
router.post('/reset-password', limits.verifyCode, resetPassword);

export default router;
