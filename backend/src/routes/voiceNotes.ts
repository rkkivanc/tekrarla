import { Router } from 'express';
import { createVoiceNote, deleteVoiceNote, getVoiceNotes } from '../controllers/voiceNotesController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/', getVoiceNotes);
router.post('/', createVoiceNote);
router.delete('/:id', deleteVoiceNote);

export default router;
