import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email: string; role: string };
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
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
    req.user = { id: p.id, email, role: p.role };
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}
