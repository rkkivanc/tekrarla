import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import type { Request, Response } from 'express';
import { pool } from '../db.js';

const SALT_ROUNDS = 10;

type UserPublic = {
  id: string;
  name: string;
  email: string | null;
  role: string;
};

export async function register(req: Request, res: Response): Promise<void> {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    res.status(500).json({ error: 'JWT_SECRET is not configured' });
    return;
  }

  try {
    const body = req.body as {
      name?: unknown;
      email?: unknown;
      password?: unknown;
      role?: unknown;
    };
    const { name, email, password, role } = body;

    if (
      typeof name !== 'string' ||
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      typeof role !== 'string' ||
      !name.trim() ||
      !email.trim() ||
      !password
    ) {
      res.status(400).json({ error: 'name, email, password, and role are required' });
      return;
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.trim()]);
    if (existing.rowCount && existing.rowCount > 0) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    const result = await pool.query<UserPublic>(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role`,
      [name.trim(), email.trim(), password_hash, role]
    );

    const user = result.rows[0];
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      jwtSecret,
      { expiresIn: '7d' },
    );

    res.status(201).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err: unknown) {
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === '23505'
    ) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }
    console.error('register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    res.status(500).json({ error: 'JWT_SECRET is not configured' });
    return;
  }

  try {
    const body = req.body as { email?: unknown; password?: unknown };
    const { email, password } = body;

    if (
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      !email.trim() ||
      !password
    ) {
      res.status(400).json({ error: 'email and password are required' });
      return;
    }

    const result = await pool.query<
      UserPublic & { password_hash: string | null }
    >(
      'SELECT id, name, email, role, password_hash FROM users WHERE email = $1',
      [email.trim()]
    );

    const row = result.rows[0];
    if (!row || !row.password_hash) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const valid = await bcrypt.compare(password, row.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const user: UserPublic = {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
    };

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      jwtSecret,
      { expiresIn: '7d' },
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
}
