import { Router } from 'express';
import {
  deleteInvitation,
  getIncomingInvitations,
  getInvitations,
  getMyTeacher,
  getStudentContent,
  getStudentStats,
  removeStudent,
  respondInvitation,
  sendInvitation,
} from '../controllers/invitationsController.js';
const router = Router();

router.post('/', sendInvitation);
router.get('/', getInvitations);
router.get('/incoming', getIncomingInvitations);
router.get('/my-teacher', getMyTeacher);
router.get('/students/:studentId/stats', getStudentStats);
router.get('/students/:studentId/content', getStudentContent);
router.delete('/students/:studentId', removeStudent);
router.delete('/:id', deleteInvitation);
router.patch('/:id', respondInvitation);

export default router;
