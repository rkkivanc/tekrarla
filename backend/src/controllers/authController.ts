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
    };
    const { name, email, password } = body;
    const role = 'student';

    if (
      typeof name !== 'string' ||
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      !name.trim() ||
      !email.trim() ||
      !password
    ) {
      res.status(400).json({ error: 'name, email, and password are required' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Şifre en az 6 karakter olmalı' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      res.status(400).json({ error: 'Geçerli bir e-posta adresi girin' });
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

export async function changePassword(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const body = req.body as { currentPassword?: unknown; newPassword?: unknown };
    const { currentPassword, newPassword } = body;

    if (
      typeof currentPassword !== 'string' ||
      typeof newPassword !== 'string' ||
      currentPassword.length === 0 ||
      newPassword.length === 0
    ) {
      res.status(400).json({ error: 'Mevcut şifre ve yeni şifre gerekli' });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({ error: 'Yeni şifre en az 6 karakter olmalı' });
      return;
    }

    const result = await pool.query<{ password_hash: string | null }>(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId],
    );
    const row = result.rows[0];
    if (!row?.password_hash) {
      res.status(401).json({ error: 'Mevcut şifre hatalı' });
      return;
    }

    const valid = await bcrypt.compare(currentPassword, row.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Mevcut şifre hatalı' });
      return;
    }

    const password_hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [password_hash, userId]);

    res.json({ message: 'Şifre güncellendi' });
  } catch (err) {
    console.error('changePassword error:', err);
    res.status(500).json({ error: 'Şifre güncellenemedi' });
  }
}
