import { Router } from 'express';
import {
  createTopic,
  deleteTopic,
  getTopics,
  updateReviewDate,
  updateTopic,
  updateTopicContent,
} from '../controllers/topicsController.js';
const router = Router();

router.get('/', getTopics);
router.post('/', createTopic);
router.patch('/:id/review-date', updateReviewDate);
router.patch('/:id/content', updateTopicContent);
router.patch('/:id', updateTopic);
router.delete('/:id', deleteTopic);

export default router;
