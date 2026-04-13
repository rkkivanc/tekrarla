import { Router } from 'express';
import {
  broadcastNotification,
  deleteUser,
  getStats,
  getUsers,
  resetUserPassword,
  sendNotificationToUser,
  updateUserRole,
} from '../controllers/adminController.js';

const router = Router();

router.get('/stats', getStats);
router.get('/users', getUsers);
router.patch('/users/:id/reset-password', resetUserPassword);
router.patch('/users/:id/role', updateUserRole);
router.post('/users/:id/notify', sendNotificationToUser);
router.delete('/users/:id', deleteUser);
router.post('/notifications/broadcast', broadcastNotification);

export default router;
