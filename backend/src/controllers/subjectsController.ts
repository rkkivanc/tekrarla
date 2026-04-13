import type { Request, Response } from 'express';
import { pool } from '../db.js';

export async function getSubjects(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const result = await pool.query<{ subject: string }>(
      `SELECT DISTINCT subject FROM (
         SELECT subject FROM questions WHERE user_id = $1 AND subject IS NOT NULL AND subject != '' AND deleted = false
         UNION
         SELECT subject FROM topics WHERE user_id = $1 AND subject IS NOT NULL AND subject != ''
       ) AS all_subjects
       ORDER BY subject`,
      [userId]
    );
    const subjects = result.rows.map((row) => row.subject);
    res.json(subjects);
  } catch (err) {
    console.error('getSubjects error:', err);
    res.status(500).json({ error: 'Failed to load subjects' });
  }
}
