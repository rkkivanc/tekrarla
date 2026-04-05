import { Router } from 'express';
import { createTopic, deleteTopic, getTopics } from '../controllers/topicsController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/', getTopics);
router.post('/', createTopic);
router.delete('/:id', deleteTopic);

export default router;
