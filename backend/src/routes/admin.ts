import { Router } from 'express';
import {
  broadcastNotification,
  deleteUser,
  getStats,
  getUsers,
  resetUserPassword,
  updateUserRole,
} from '../controllers/adminController.js';

const router = Router();

router.get('/stats', getStats);
router.get('/users', getUsers);
router.patch('/users/:id/reset-password', resetUserPassword);
router.patch('/users/:id/role', updateUserRole);
router.delete('/users/:id', deleteUser);
router.post('/notifications/broadcast', broadcastNotification);

export default router;
