import { Router } from 'express';
import { getSubjects } from '../controllers/subjectsController.js';

const router = Router();

router.get('/', getSubjects);

export default router;
