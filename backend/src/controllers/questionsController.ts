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
  if (!['easy', 'medium', 'hard'].includes(diffKey)) {
    res.status(400).json({ error: 'difficulty must be easy, medium, or hard' });
    return;
  }

  const next_review_at = nextReviewAtForDifficulty(diffKey);

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
