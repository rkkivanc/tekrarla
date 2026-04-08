import type { Request, Response } from 'express';
import type { PushSubscription } from 'web-push';
import { pool } from '../db.js';

function isPushSubscription(value: unknown): value is PushSubscription {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const o = value as Record<string, unknown>;
  if (typeof o.endpoint !== 'string' || !o.endpoint.trim()) {
    return false;
  }
  const keys = o.keys;
  if (typeof keys !== 'object' || keys === null) {
    return false;
  }
  const k = keys as Record<string, unknown>;
  return typeof k.p256dh === 'string' && typeof k.auth === 'string';
}

export async function saveSubscription(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const body = req.body as { subscription?: unknown };
  if (!isPushSubscription(body.subscription)) {
    res.status(400).json({ error: 'subscription with endpoint and keys is required' });
    return;
  }

  try {
    await pool.query(
      `INSERT INTO push_subscriptions (user_id, subscription)
       VALUES ($1, $2::jsonb)
       ON CONFLICT (user_id) DO UPDATE SET subscription = EXCLUDED.subscription`,
      [userId, JSON.stringify(body.subscription)]
    );
    res.sendStatus(200);
  } catch (err) {
    console.error('saveSubscription error:', err);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
}

export async function updateNotificationTime(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const body = req.body as { notification_time?: unknown };
  if (typeof body.notification_time !== 'string') {
    res.status(400).json({ error: 'notification_time is required' });
    return;
  }

  const notification_time = body.notification_time;
  const timePart = notification_time.substring(0, 5);

  try {
    const result = await pool.query(`UPDATE users SET notification_time = $1::time WHERE id = $2`, [
      timePart,
      userId,
    ]);
    if (!result.rowCount) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.sendStatus(200);
  } catch (err) {
    console.error('updateNotificationTime error:', err);
    res.status(500).json({ error: 'Failed to update notification time' });
  }
}

export async function getNotificationSettings(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const userResult = await pool.query<{ notification_time: string | null }>(
      `SELECT to_char(notification_time::time, 'HH24:MI') AS notification_time
       FROM users
       WHERE id = $1`,
      [userId]
    );
    const row = userResult.rows[0];
    if (!row) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const subResult = await pool.query(`SELECT 1 FROM push_subscriptions WHERE user_id = $1 LIMIT 1`, [
      userId,
    ]);

    res.json({
      notificationTime: row.notification_time,
      hasSubscription: (subResult.rowCount ?? 0) > 0,
    });
  } catch (err) {
    console.error('getNotificationSettings error:', err);
    res.status(500).json({ error: 'Failed to load notification settings' });
  }
}
