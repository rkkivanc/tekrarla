import type { Request, Response } from 'express';
import { pool } from '../db.js';

type TopicRow = {
  id: string;
  user_id: string;
  title: string;
  notes: string | null;
  image_url: string | null;
  created_at: Date;
  next_review_at: Date | null;
  review_count: number;
};

function nextReviewInThreeDays(): Date {
  return new Date(Date.now() + 3 * 86_400_000);
}

export async function getTopics(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const result = await pool.query<TopicRow>(
      `SELECT id, user_id, title, notes, image_url, created_at, next_review_at, review_count
       FROM topics
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('getTopics error:', err);
    res.status(500).json({ error: 'Failed to load topics' });
  }
}

export async function createTopic(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const body = req.body as {
    title?: unknown;
    notes?: unknown;
    image_url?: unknown;
  };

  if (typeof body.title !== 'string' || !body.title.trim()) {
    res.status(400).json({ error: 'title is required' });
    return;
  }

  const title = body.title.trim();
  const notes = typeof body.notes === 'string' ? body.notes : '';
  const image_url =
    typeof body.image_url === 'string' && body.image_url.trim() ? body.image_url.trim() : null;

  const next_review_at = nextReviewInThreeDays();

  try {
    const result = await pool.query<TopicRow>(
      `INSERT INTO topics (user_id, title, notes, image_url, next_review_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, user_id, title, notes, image_url, created_at, next_review_at, review_count`,
      [userId, title, notes, image_url, next_review_at]
    );
    const row = result.rows[0];
    if (!row) {
      res.status(500).json({ error: 'Failed to create topic' });
      return;
    }
    res.status(201).json(row);
  } catch (err) {
    console.error('createTopic error:', err);
    res.status(500).json({ error: 'Failed to create topic' });
  }
}

export async function deleteTopic(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { id } = req.params;
  if (!id) {
    res.status(400).json({ error: 'id is required' });
    return;
  }

  try {
    const result = await pool.query(`DELETE FROM topics WHERE id = $1 AND user_id = $2`, [id, userId]);
    if (!result.rowCount) {
      res.status(404).json({ error: 'Topic not found' });
      return;
    }
    res.sendStatus(200);
  } catch (err) {
    console.error('deleteTopic error:', err);
    res.status(500).json({ error: 'Failed to delete topic' });
  }
}
