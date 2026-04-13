import { Router } from 'express';
import { register, login } from '../controllers/authController.js';
import { verifyTurnstile } from '../middleware/turnstile.js';

const router = Router();

router.post('/register', verifyTurnstile, register);
router.post('/login', verifyTurnstile, login);

export default router;
