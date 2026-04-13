import { Router } from 'express';
import {
  createQuestion,
  deleteQuestion,
  getQuestions,
  updateQuestion,
  updateQuestionContent,
  updateReviewDate,
} from '../controllers/questionsController.js';
const router = Router();

router.get('/', getQuestions);
router.post('/', createQuestion);
router.patch('/:id/review-date', updateReviewDate);
router.patch('/:id/content', updateQuestionContent);
router.patch('/:id', updateQuestion);
router.delete('/:id', deleteQuestion);

export default router;
