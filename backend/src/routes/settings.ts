import { Router } from 'express';
import { getDifficultySettings, updateDifficultySettings } from '../controllers/settingsController.js';
const router = Router();

router.get('/difficulty', getDifficultySettings);
router.patch('/difficulty', updateDifficultySettings);

export default router;
