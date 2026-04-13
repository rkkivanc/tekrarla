import { Router } from 'express';
import { createVoiceNote, deleteVoiceNote, getVoiceNotes } from '../controllers/voiceNotesController.js';
const router = Router();

router.get('/', getVoiceNotes);
router.post('/', createVoiceNote);
router.delete('/:id', deleteVoiceNote);

export default router;
