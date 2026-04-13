import { Router } from 'express';
import {
  createTopic,
  deleteTopic,
  getTopics,
  updateReviewDate,
  updateTopic,
  updateTopicContent,
} from '../controllers/topicsController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/', getTopics);
router.post('/', createTopic);
router.patch('/:id/review-date', updateReviewDate);
router.patch('/:id/content', updateTopicContent);
router.patch('/:id', updateTopic);
router.delete('/:id', deleteTopic);

export default router;
