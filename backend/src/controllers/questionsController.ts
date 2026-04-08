import type { Request, Response } from 'express';
import { pool } from '../db.js';

type QuestionRow = {
  id: string;
  user_id: string;
  image_url: string;
  answer_image_url: string | null;
  answer_text: string | null;
  difficulty: string | null;
  subject: string | null;
  created_at: Date;
  next_review_at: Date | null;
  review_count: number;
  solved: boolean;
  deleted: boolean;
  last_result?: string | null;
};

function nextReviewAtForDifficulty(difficulty: string): Date {
  const d = difficulty.toLowerCase();
  let days: number;
  if (d === 'hard') {
    days = 1;
  } else if (d === 'medium') {
    days = 3;
  } else if (d === 'easy') {
    days = 5;
  } else {
    days = 3;
  }
  return new Date(Date.now() + days * 86_400_000);
}

export async function getQuestions(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const result = await pool.query<QuestionRow>(
      `SELECT id, user_id, image_url, answer_image_url, answer_text, difficulty, subject,
              created_at, next_review_at, review_count, solved, deleted
       FROM questions
       WHERE user_id = $1 AND deleted = false`,
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('getQuestions error:', err);
    res.status(500).json({ error: 'Failed to load questions' });
  }
}

export async function createQuestion(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const body = req.body as {
    image_url?: unknown;
    answer_image_url?: unknown;
    answer_text?: unknown;
    difficulty?: unknown;
    subject?: unknown;
    next_review_at?: unknown;
  };

  if (typeof body.image_url !== 'string' || !body.image_url.trim()) {
    res.status(400).json({ error: 'image_url is required' });
    return;
  }

  const image_url = body.image_url.trim();
  const answer_image_url =
    typeof body.answer_image_url === 'string' ? body.answer_image_url : null;
  const answer_text = typeof body.answer_text === 'string' ? body.answer_text : null;
  const difficulty = typeof body.difficulty === 'string' ? body.difficulty : null;
  const subject = typeof body.subject === 'string' ? body.subject : null;

  const diffKey = (difficulty ?? 'medium').toLowerCase();
  if (!['easy', 'medium', 'hard', 'custom'].includes(diffKey)) {
    res.status(400).json({ error: 'difficulty must be easy, medium, hard, or custom' });
    return;
  }

  let next_review_at: Date;
  if (typeof body.next_review_at === 'string' && body.next_review_at.trim()) {
    const parsed = new Date(body.next_review_at.trim());
    if (Number.isNaN(parsed.getTime())) {
      res.status(400).json({ error: 'next_review_at must be a valid ISO date' });
      return;
    }
    next_review_at = parsed;
  } else {
    next_review_at = nextReviewAtForDifficulty(diffKey);
  }

  try {
    const result = await pool.query<QuestionRow>(
      `INSERT INTO questions (
         user_id, image_url, answer_image_url, answer_text, difficulty, subject, next_review_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, user_id, image_url, answer_image_url, answer_text, difficulty, subject,
                 created_at, next_review_at, review_count, solved, deleted`,
      [userId, image_url, answer_image_url, answer_text, difficulty, subject, next_review_at]
    );
    const row = result.rows[0];
    if (!row) {
      res.status(500).json({ error: 'Failed to create question' });
      return;
    }
    res.status(201).json(row);
  } catch (err) {
    console.error('createQuestion error:', err);
    res.status(500).json({ error: 'Failed to create question' });
  }
}

export async function updateQuestion(req: Request, res: Response): Promise<void> {
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
    solved?: unknown;
    review_count?: unknown;
    next_review_at?: unknown;
    last_result?: unknown;
  };

  if (typeof body.solved !== 'boolean') {
    res.status(400).json({ error: 'solved must be a boolean' });
    return;
  }
  if (typeof body.review_count !== 'number' || !Number.isInteger(body.review_count)) {
    res.status(400).json({ error: 'review_count must be an integer' });
    return;
  }
  if (typeof body.next_review_at !== 'string') {
    res.status(400).json({ error: 'next_review_at must be a string' });
    return;
  }

  let lastResultParam: string | null = null;
  if (body.last_result !== undefined) {
    if (body.last_result !== 'solved' && body.last_result !== 'failed') {
      res.status(400).json({ error: "last_result must be 'solved' or 'failed'" });
      return;
    }
    lastResultParam = body.last_result;
  }

  const nextReviewAt = new Date(body.next_review_at);
  if (Number.isNaN(nextReviewAt.getTime())) {
    res.status(400).json({ error: 'next_review_at must be a valid ISO date' });
    return;
  }

  try {
    const result = await pool.query<QuestionRow>(
      `UPDATE questions
       SET solved = $3, review_count = $4, next_review_at = $5,
           last_result = COALESCE($6, last_result)
       WHERE id = $1 AND user_id = $2
       RETURNING id, user_id, image_url, answer_image_url, answer_text, difficulty, subject,
                 created_at, next_review_at, review_count, solved, deleted, last_result`,
      [id, userId, body.solved, body.review_count, nextReviewAt, lastResultParam]
    );
    const row = result.rows[0];
    if (!row) {
      res.status(404).json({ error: 'Question not found' });
      return;
    }
    res.json(row);
  } catch (err) {
    console.error('updateQuestion error:', err);
    res.status(500).json({ error: 'Failed to update question' });
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
    const result = await pool.query<QuestionRow>(
      `UPDATE questions
       SET next_review_at = NOW() + make_interval(days => $3::int, hours => $4::int, mins => $5::int)
       WHERE id = $1 AND user_id = $2
       RETURNING id, user_id, image_url, answer_image_url, answer_text, difficulty, subject,
                 created_at, next_review_at, review_count, solved, deleted`,
      [id, userId, days, hours, minutes]
    );
    const row = result.rows[0];
    if (!row) {
      res.status(404).json({ error: 'Question not found' });
      return;
    }
    res.json(row);
  } catch (err) {
    console.error('updateReviewDate error:', err);
    res.status(500).json({ error: 'Failed to update review date' });
  }
}

export async function deleteQuestion(req: Request, res: Response): Promise<void> {
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
    const result = await pool.query(
      `UPDATE questions SET deleted = true WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    if (!result.rowCount) {
      res.status(404).json({ error: 'Question not found' });
      return;
    }
    res.sendStatus(200);
  } catch (err) {
    console.error('deleteQuestion error:', err);
    res.status(500).json({ error: 'Failed to delete question' });
  }
}
