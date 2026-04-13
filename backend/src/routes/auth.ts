import { Router } from 'express';
import { register, login, changePassword } from '../controllers/authController.js';
import { verifyTurnstile } from '../middleware/turnstile.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/register', verifyTurnstile, register);
router.post('/login', verifyTurnstile, login);
router.patch('/change-password', requireAuth, changePassword);

export default router;
