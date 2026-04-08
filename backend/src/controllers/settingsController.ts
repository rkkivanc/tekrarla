import type { Request, Response } from 'express';
import { pool } from '../db.js';

const DEFAULT_DAYS = { hard: 1, medium: 3, easy: 5 };

type DifficultySettingsShape = { hard: number; medium: number; easy: number };

function parseDifficultySettings(raw: unknown): DifficultySettingsShape {
  if (raw === null || raw === undefined) {
    return { ...DEFAULT_DAYS };
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_DAYS };
  }
  const o = raw as Record<string, unknown>;
  const hard = o.hard;
  const medium = o.medium;
  const easy = o.easy;
  return {
    hard: typeof hard === 'number' && Number.isInteger(hard) && hard > 0 ? hard : DEFAULT_DAYS.hard,
    medium: typeof medium === 'number' && Number.isInteger(medium) && medium > 0 ? medium : DEFAULT_DAYS.medium,
    easy: typeof easy === 'number' && Number.isInteger(easy) && easy > 0 ? easy : DEFAULT_DAYS.easy,
  };
}

export async function getDifficultySettings(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const result = await pool.query<{ difficulty_settings: unknown }>(
      `SELECT difficulty_settings FROM users WHERE id = $1`,
      [userId]
    );
    const row = result.rows[0];
    if (!row) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json(parseDifficultySettings(row.difficulty_settings));
  } catch (err) {
    console.error('getDifficultySettings error:', err);
    res.status(500).json({ error: 'Failed to load difficulty settings' });
  }
}

export async function updateDifficultySettings(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const body = req.body as { hard?: unknown; medium?: unknown; easy?: unknown };
  const { hard, medium, easy } = body;

  if (typeof hard !== 'number' || !Number.isInteger(hard) || hard < 1) {
    res.status(400).json({ error: 'hard must be a positive integer (days)' });
    return;
  }
  if (typeof medium !== 'number' || !Number.isInteger(medium) || medium < 1) {
    res.status(400).json({ error: 'medium must be a positive integer (days)' });
    return;
  }
  if (typeof easy !== 'number' || !Number.isInteger(easy) || easy < 1) {
    res.status(400).json({ error: 'easy must be a positive integer (days)' });
    return;
  }

  const payload = JSON.stringify({ hard, medium, easy });

  try {
    const result = await pool.query(
      `UPDATE users SET difficulty_settings = $1::jsonb WHERE id = $2`,
      [payload, userId]
    );
    if (!result.rowCount) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.sendStatus(200);
  } catch (err) {
    console.error('updateDifficultySettings error:', err);
    res.status(500).json({ error: 'Failed to update difficulty settings' });
  }
}
