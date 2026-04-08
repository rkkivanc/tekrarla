import { Router } from 'express';
import {
  createQuestion,
  deleteQuestion,
  getQuestions,
  updateQuestion,
  updateReviewDate,
} from '../controllers/questionsController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/', getQuestions);
router.post('/', createQuestion);
router.patch('/:id/review-date', updateReviewDate);
router.patch('/:id', updateQuestion);
router.delete('/:id', deleteQuestion);

export default router;
