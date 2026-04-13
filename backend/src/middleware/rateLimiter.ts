import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import type { Request } from 'express';

/** `req.user` is usually unset here (this runs before `requireAuth`); Bearer JWT id when valid, else IP. */
function contentRateLimitKey(req: Request): string {
  if (req.user?.id) return req.user.id;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length).trim();
    const secret = process.env.JWT_SECRET;
    if (secret) {
      try {
        const payload = jwt.verify(token, secret);
        if (typeof payload === 'object' && payload !== null && typeof (payload as { id?: unknown }).id === 'string') {
          return (payload as { id: string }).id;
        }
      } catch {
        /* invalid or expired token */
      }
    }
  }
  return req.ip ?? 'unknown';
}

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ error: 'Çok fazla istek. Lütfen 15 dakika sonra tekrar deneyin.' });
  },
});

export const contentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: contentRateLimitKey,
  handler: (_req, res) => {
    res.status(429).json({ error: 'Çok fazla istek. Lütfen biraz bekleyin.' });
  },
});
