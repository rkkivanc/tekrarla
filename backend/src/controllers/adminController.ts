import type { Request, Response } from 'express';
import { pool } from '../db.js';

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
