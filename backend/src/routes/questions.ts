import { Router } from 'express';
import { createQuestion, deleteQuestion, getQuestions } from '../controllers/questionsController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/', getQuestions);
router.post('/', createQuestion);
router.delete('/:id', deleteQuestion);

export default router;
