import { Router } from 'express';
import { register, login, changePassword, forceChangePassword } from '../controllers/authController.js';
import { verifyTurnstile } from '../middleware/turnstile.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/register', verifyTurnstile, register);
router.post('/login', verifyTurnstile, login);
router.patch('/change-password', requireAuth, changePassword);
router.patch('/force-change-password', requireAuth, forceChangePassword);

export default router;
