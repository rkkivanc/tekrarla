import type { Request, Response } from 'express';
import { Router } from 'express';
import {
  getNotificationSettings,
  saveSubscription,
  updateNotificationTime,
} from '../controllers/notificationsController.js';
import { pool } from '../db.js';
import { requireAuth, requirePasswordChanged } from '../middleware/auth.js';

const router = Router();

router.get('/vapid-public-key', (_req: Request, res: Response) => {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!publicKey) {
    res.status(500).json({ error: 'VAPID public key is not configured' });
    return;
  }
  res.json({ publicKey });
});

router.use(requireAuth, requirePasswordChanged);

router.get('/settings', getNotificationSettings);
router.post('/subscribe', saveSubscription);
router.patch('/time', updateNotificationTime);

router.delete('/subscribe', async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    await pool.query('DELETE FROM push_subscriptions WHERE user_id = $1', [userId]);
    res.sendStatus(200);
  } catch (err) {
    console.error('delete subscription error:', err);
    res.status(500).json({ error: 'Failed to remove subscription' });
  }
});

export default router;
