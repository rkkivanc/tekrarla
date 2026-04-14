import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import jwt from 'jsonwebtoken';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  handler: (_req, res) => {
    res.status(429).json({ error: 'Çok fazla istek. Lütfen 15 dakika sonra tekrar deneyin.' });
  },
});

export const changePasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  handler: (_req, res) => {
    res.status(429).json({ error: 'Çok fazla deneme. Lütfen 15 dakika sonra tekrar deneyin.' });
  },
});

export const contentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: req => {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.slice(7).trim();
        const secret = process.env.JWT_SECRET;
        if (secret) {
          const payload = jwt.verify(token, secret) as { id?: string };
          if (payload.id) return payload.id;
        }
      } catch {
        // Token invalid, fall through to IP
      }
    }
    return ipKeyGenerator(req.ip || 'unknown');
  },
  validate: { xForwardedForHeader: false },
  handler: (_req, res) => {
    res.status(429).json({ error: 'Çok fazla istek. Lütfen biraz bekleyin.' });
  },
});
