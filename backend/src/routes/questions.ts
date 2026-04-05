import { Router } from 'express';
import { createQuestion, deleteQuestion, getQuestions, updateQuestion } from '../controllers/questionsController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/', getQuestions);
router.post('/', createQuestion);
router.patch('/:id', updateQuestion);
router.delete('/:id', deleteQuestion);

export default router;
