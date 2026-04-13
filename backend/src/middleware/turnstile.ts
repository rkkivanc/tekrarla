import type { Request, Response, NextFunction } from 'express';

type SiteverifyResponse = {
  success?: boolean;
};

export async function verifyTurnstile(req: Request, res: Response, next: NextFunction): Promise<void> {
  const body = req.body as { turnstileToken?: unknown };
  const turnstileToken = typeof body.turnstileToken === 'string' ? body.turnstileToken.trim() : '';

  if (!turnstileToken) {
    res.status(400).json({ error: 'Bot doğrulaması gerekli' });
    return;
  }

  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    res.status(500).json({ error: 'Turnstile yapılandırılmamış' });
    return;
  }

  let data: SiteverifyResponse;
  try {
    const cfRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, response: turnstileToken }),
    });
    data = (await cfRes.json()) as SiteverifyResponse;
  } catch {
    res.status(403).json({ error: 'Bot doğrulaması başarısız' });
    return;
  }

  if (data.success === true) {
    next();
    return;
  }

  res.status(403).json({ error: 'Bot doğrulaması başarısız' });
}
