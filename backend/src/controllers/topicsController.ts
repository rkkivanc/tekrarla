import type { Request, Response } from 'express';
import { pool } from '../db.js';

type TopicRow = {
  id: string;
  user_id: string;
  title: string;
  notes: string | null;
  image_url: string | null;
  subject: string | null;
  created_at: Date;
  next_review_at: Date | null;
  review_count: number;
  last_result?: string | null;
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
      `SELECT id, user_id, title, notes, image_url, subject, created_at, next_review_at, review_count, last_result
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
    next_review_at?: unknown;
    subject?: unknown;
  };

  if (typeof body.title !== 'string' || !body.title.trim()) {
    res.status(400).json({ error: 'title is required' });
    return;
  }

  const title = body.title.trim();
  const notes = typeof body.notes === 'string' ? body.notes : '';
  const image_url =
    typeof body.image_url === 'string' && body.image_url.trim() ? body.image_url.trim() : null;

  const subject =
    typeof body.subject === 'string' ? body.subject.trim().toLowerCase() || null : null;

  let next_review_at: Date;
  if (typeof body.next_review_at === 'string' && body.next_review_at.trim()) {
    const parsed = new Date(body.next_review_at.trim());
    if (Number.isNaN(parsed.getTime())) {
      res.status(400).json({ error: 'next_review_at must be a valid ISO date' });
      return;
    }
    next_review_at = parsed;
  } else {
    next_review_at = nextReviewInThreeDays();
  }

  try {
    const result = await pool.query<TopicRow>(
      `INSERT INTO topics (user_id, title, notes, image_url, next_review_at, subject)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, user_id, title, notes, image_url, subject, created_at, next_review_at, review_count, last_result`,
      [userId, title, notes, image_url, next_review_at, subject]
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

export async function updateTopic(req: Request, res: Response): Promise<void> {
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

  const body = req.body as {
    review_count?: unknown;
    next_review_at?: unknown;
    last_result?: unknown;
  };

  if (typeof body.review_count !== 'number' || !Number.isInteger(body.review_count)) {
    res.status(400).json({ error: 'review_count must be an integer' });
    return;
  }
  if (typeof body.next_review_at !== 'string' || !body.next_review_at.trim()) {
    res.status(400).json({ error: 'next_review_at must be a string' });
    return;
  }

  const nextReviewAt = new Date(body.next_review_at.trim());
  if (Number.isNaN(nextReviewAt.getTime())) {
    res.status(400).json({ error: 'next_review_at must be a valid ISO date' });
    return;
  }

  let lastResultParam: string | null = null;
  if (body.last_result !== undefined) {
    if (body.last_result !== 'understood' && body.last_result !== 'not_understood') {
      res.status(400).json({ error: "last_result must be 'understood' or 'not_understood'" });
      return;
    }
    lastResultParam = body.last_result;
  }

  try {
    const result = await pool.query<TopicRow>(
      `UPDATE topics
       SET review_count = $3, next_review_at = $4,
           last_result = COALESCE($5, last_result)
       WHERE id = $1 AND user_id = $2
       RETURNING id, user_id, title, notes, image_url, subject, created_at, next_review_at, review_count, last_result`,
      [id, userId, body.review_count, nextReviewAt, lastResultParam]
    );
    const row = result.rows[0];
    if (!row) {
      res.status(404).json({ error: 'Topic not found' });
      return;
    }
    res.json(row);
  } catch (err) {
    console.error('updateTopic error:', err);
    res.status(500).json({ error: 'Failed to update topic' });
  }
}

export async function updateReviewDate(req: Request, res: Response): Promise<void> {
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

  const body = req.body as { days?: unknown; hours?: unknown; minutes?: unknown };
  const { days, hours, minutes } = body;

  if (typeof days !== 'number' || !Number.isInteger(days) || days < 0) {
    res.status(400).json({ error: 'days must be a non-negative integer' });
    return;
  }
  if (typeof hours !== 'number' || !Number.isInteger(hours) || hours < 0) {
    res.status(400).json({ error: 'hours must be a non-negative integer' });
    return;
  }
  if (typeof minutes !== 'number' || !Number.isInteger(minutes) || minutes < 0) {
    res.status(400).json({ error: 'minutes must be a non-negative integer' });
    return;
  }

  try {
    const result = await pool.query<TopicRow>(
      `UPDATE topics
       SET next_review_at = NOW() + make_interval(days => $3::int, hours => $4::int, mins => $5::int)
       WHERE id = $1 AND user_id = $2
       RETURNING id, user_id, title, notes, image_url, subject, created_at, next_review_at, review_count, last_result`,
      [id, userId, days, hours, minutes]
    );
    const row = result.rows[0];
    if (!row) {
      res.status(404).json({ error: 'Topic not found' });
      return;
    }
    res.json(row);
  } catch (err) {
    console.error('updateReviewDate error:', err);
    res.status(500).json({ error: 'Failed to update review date' });
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
