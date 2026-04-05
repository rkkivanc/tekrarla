import type { Request, Response } from 'express';
import { pool } from '../db.js';

type VoiceNoteRow = {
  id: string;
  user_id: string;
  title: string;
  audio_url: string;
  duration: number | null;
  created_at: Date;
};

export async function getVoiceNotes(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const result = await pool.query<VoiceNoteRow>(
      `SELECT id, user_id, title, audio_url, duration, created_at
       FROM voice_notes
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('getVoiceNotes error:', err);
    res.status(500).json({ error: 'Failed to load voice notes' });
  }
}

export async function createVoiceNote(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const body = req.body as {
    title?: unknown;
    audio_url?: unknown;
    duration?: unknown;
  };

  if (typeof body.title !== 'string' || !body.title.trim()) {
    res.status(400).json({ error: 'title is required' });
    return;
  }
  if (typeof body.audio_url !== 'string' || !body.audio_url.trim()) {
    res.status(400).json({ error: 'audio_url is required' });
    return;
  }
  if (typeof body.duration !== 'number' || !Number.isFinite(body.duration) || body.duration < 0) {
    res.status(400).json({ error: 'duration is required' });
    return;
  }

  const title = body.title.trim();
  const audio_url = body.audio_url.trim();

  try {
    const result = await pool.query<VoiceNoteRow>(
      `INSERT INTO voice_notes (user_id, title, audio_url, duration)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id, title, audio_url, duration, created_at`,
      [userId, title, audio_url, Math.floor(body.duration)]
    );
    const row = result.rows[0];
    if (!row) {
      res.status(500).json({ error: 'Failed to create voice note' });
      return;
    }
    res.status(201).json(row);
  } catch (err) {
    console.error('createVoiceNote error:', err);
    res.status(500).json({ error: 'Failed to create voice note' });
  }
}

export async function deleteVoiceNote(req: Request, res: Response): Promise<void> {
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
    const result = await pool.query(`DELETE FROM voice_notes WHERE id = $1 AND user_id = $2`, [id, userId]);
    if (!result.rowCount) {
      res.status(404).json({ error: 'Voice note not found' });
      return;
    }
    res.sendStatus(200);
  } catch (err) {
    console.error('deleteVoiceNote error:', err);
    res.status(500).json({ error: 'Failed to delete voice note' });
  }
}
