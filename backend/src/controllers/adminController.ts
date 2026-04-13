import type { Request, Response } from 'express';
import type { PushSubscription } from 'web-push';
import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { pool } from '../db.js';
import { sendPushNotification } from '../services/pushService.js';

const SALT_ROUNDS = 10;

type UserRow = {
  id: string;
  name: string;
  email: string | null;
  role: string;
  created_at: Date;
};

export async function getUsers(_req: Request, res: Response): Promise<void> {
  try {
    const result = await pool.query<UserRow>(
      `SELECT id, name, email, role, created_at
       FROM users
       ORDER BY created_at DESC`,
    );
    const users = result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      created_at: row.created_at,
    }));
    res.json(users);
  } catch (err) {
    console.error('getUsers error:', err);
    res.status(500).json({ error: 'Failed to load users' });
  }
}

export async function updateUserRole(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const id = typeof req.params.id === 'string' ? req.params.id : '';
  if (!id) {
    res.status(400).json({ error: 'Invalid user id' });
    return;
  }

  if (userId === id) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const body = req.body as { role?: unknown };
  const role = body.role;
  if (role !== 'student' && role !== 'teacher') {
    res.status(400).json({ error: 'role must be student or teacher' });
    return;
  }

  try {
    const result = await pool.query<UserRow>(
      `UPDATE users SET role = $1 WHERE id = $2
       RETURNING id, name, email, role, created_at`,
      [role, id],
    );
    const row = result.rows[0];
    if (!row) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      created_at: row.created_at,
    });
  } catch (err) {
    console.error('updateUserRole error:', err);
    res.status(500).json({ error: 'Failed to update role' });
  }
}

type StatsRow = {
  total_users: string;
  total_teachers: string;
  total_students: string;
  total_questions: string;
  total_topics: string;
  total_voice_notes: string;
  users_reviewed_today: string;
};

export async function getStats(_req: Request, res: Response): Promise<void> {
  try {
    const result = await pool.query<StatsRow>(
      `SELECT
        (SELECT COUNT(*) FROM users) AS total_users,
        (SELECT COUNT(*) FROM users WHERE role = 'teacher') AS total_teachers,
        (SELECT COUNT(*) FROM users WHERE role = 'student') AS total_students,
        (SELECT COUNT(*) FROM questions WHERE deleted = false) AS total_questions,
        (SELECT COUNT(*) FROM topics) AS total_topics,
        (SELECT COUNT(*) FROM voice_notes) AS total_voice_notes,
        (SELECT COUNT(DISTINCT user_id) FROM questions WHERE deleted = false AND next_review_at IS NOT NULL AND next_review_at::date = CURRENT_DATE) AS users_reviewed_today`
    );
    const row = result.rows[0];
    if (!row) {
      res.status(500).json({ error: 'Failed to load stats' });
      return;
    }
    res.json({
      total_users: Number(row.total_users),
      total_teachers: Number(row.total_teachers),
      total_students: Number(row.total_students),
      total_questions: Number(row.total_questions),
      total_topics: Number(row.total_topics),
      total_voice_notes: Number(row.total_voice_notes),
      users_reviewed_today: Number(row.users_reviewed_today),
    });
  } catch (err) {
    console.error('getStats error:', err);
    res.status(500).json({ error: 'Failed to load stats' });
  }
}

export async function resetUserPassword(req: Request, res: Response): Promise<void> {
  const adminId = req.user?.id;
  if (!adminId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const id = typeof req.params.id === 'string' ? req.params.id : '';
  if (!id) {
    res.status(400).json({ error: 'Invalid user id' });
    return;
  }

  if (adminId === id) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const plainTextPassword = randomBytes(4).toString('hex');

  try {
    const password_hash = await bcrypt.hash(plainTextPassword, SALT_ROUNDS);
    const result = await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [password_hash, id]);
    if (!result.rowCount) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ temporaryPassword: plainTextPassword });
  } catch (err) {
    console.error('resetUserPassword error:', err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
}

export async function deleteUser(req: Request, res: Response): Promise<void> {
  const adminId = req.user?.id;
  if (!adminId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const id = typeof req.params.id === 'string' ? req.params.id : '';
  if (!id) {
    res.status(400).json({ error: 'Invalid user id' });
    return;
  }

  if (adminId === id) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const client = await pool.connect();
  try {
    const roleRes = await client.query<{ role: string }>(`SELECT role FROM users WHERE id = $1`, [id]);
    const target = roleRes.rows[0];
    if (!target) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    if (target.role === 'admin') {
      res.status(403).json({ error: 'Cannot delete admin users' });
      return;
    }

    await client.query('BEGIN');
    try {
      await client.query(`UPDATE users SET teacher_id = NULL WHERE teacher_id = $1`, [id]);
      await client.query(`DELETE FROM classes WHERE teacher_id = $1`, [id]);
      await client.query(`DELETE FROM push_subscriptions WHERE user_id = $1`, [id]);
      await client.query(`DELETE FROM invitations WHERE teacher_id = $1 OR student_id = $1`, [id]);
      await client.query(`DELETE FROM voice_notes WHERE user_id = $1`, [id]);
      await client.query(`DELETE FROM topics WHERE user_id = $1`, [id]);
      await client.query(`DELETE FROM questions WHERE user_id = $1`, [id]);
      await client.query(`DELETE FROM users WHERE id = $1`, [id]);
      await client.query('COMMIT');
      res.json({ message: 'User deleted' });
    } catch (inner) {
      await client.query('ROLLBACK');
      throw inner;
    }
  } catch (err) {
    console.error('deleteUser error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to delete user' });
    }
  } finally {
    client.release();
  }
}

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

export async function broadcastNotification(req: Request, res: Response): Promise<void> {
  const body = req.body as { title?: unknown; body?: unknown };
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const messageBody = typeof body.body === 'string' ? body.body.trim() : '';
  if (!title || !messageBody) {
    res.status(400).json({ error: 'title and body are required' });
    return;
  }

  try {
    const subResult = await pool.query<{ subscription: unknown }>(
      `SELECT subscription FROM push_subscriptions`
    );
    let sent = 0;
    let failed = 0;
    for (const row of subResult.rows) {
      const raw = row.subscription;
      if (!isPushSubscription(raw)) {
        failed += 1;
        continue;
      }
      try {
        await sendPushNotification(raw, title, messageBody);
        sent += 1;
      } catch {
        failed += 1;
      }
    }
    res.json({ sent, failed });
  } catch (err) {
    console.error('broadcastNotification error:', err);
    res.status(500).json({ error: 'Failed to broadcast notification' });
  }
}
