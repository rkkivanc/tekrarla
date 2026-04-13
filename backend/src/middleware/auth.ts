import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { pool } from '../db.js';

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email: string; role: string; forcePasswordChange: boolean };
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    res.status(500).json({ error: 'JWT_SECRET is not configured' });
    return;
  }

  try {
    const payload = jwt.verify(token, secret);
    if (typeof payload !== 'object' || payload === null || typeof (payload as { id?: unknown }).id !== 'string') {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const p = payload as { id: string; email?: unknown; role?: unknown };
    if (typeof p.role !== 'string') {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const email = typeof p.email === 'string' ? p.email : '';
    const userExists = await pool.query<{ force_password_change: boolean }>(
      'SELECT id, force_password_change FROM users WHERE id = $1',
      [p.id],
    );
    if (!userExists.rowCount) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const dbRow = userExists.rows[0];
    req.user = {
      id: p.id,
      email,
      role: p.role,
      forcePasswordChange: Boolean(dbRow?.force_password_change),
    };

    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

/** Expects `requireAuth` to have run on the same request (sets `req.user`). */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  next();
}

export function requirePasswordChanged(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.forcePasswordChange) {
    res.status(403).json({ error: 'PASSWORD_CHANGE_REQUIRED' });
    return;
  }
  next();
}
