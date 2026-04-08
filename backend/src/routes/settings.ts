import { Router } from 'express';
import { getDifficultySettings, updateDifficultySettings } from '../controllers/settingsController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/difficulty', getDifficultySettings);
router.patch('/difficulty', updateDifficultySettings);

export default router;
