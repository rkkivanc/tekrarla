import type { Request, Response } from 'express';
import { pool } from '../db.js';

type InvitationRow = {
  id: string;
  teacher_id: string;
  student_email: string;
  student_id: string | null;
  status: string;
  created_at: Date;
  updated_at: Date;
};

export async function sendInvitation(req: Request, res: Response): Promise<void> {
  if (req.user?.role !== 'teacher') {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const teacherId = req.user.id;
  const body = req.body as { student_email?: unknown };
  if (typeof body.student_email !== 'string' || !body.student_email.trim()) {
    res.status(400).json({ error: 'student_email is required' });
    return;
  }

  const studentEmailInput = body.student_email.trim();

  try {
    const userResult = await pool.query<{ id: string; email: string | null }>(
      `SELECT id, email FROM users WHERE email = $1`,
      [studentEmailInput]
    );
    const student = userResult.rows[0];
    if (!student || !student.email) {
      res.status(404).json({ error: 'Bu email ile kayıtlı kullanıcı bulunamadı' });
      return;
    }

    const existing = await pool.query<{ id: string; status: string }>(
      `SELECT id, status FROM invitations WHERE teacher_id = $1 AND student_email = $2`,
      [teacherId, student.email]
    );
    const existingRow = existing.rows[0];
    if (existingRow) {
      if (existingRow.status === 'pending') {
        res.status(409).json({ error: 'Zaten bekleyen bir davet var' });
        return;
      }
      if (existingRow.status === 'accepted') {
        res.status(409).json({ error: 'Bu öğrenci zaten sınıfında' });
        return;
      }
      if (existingRow.status === 'rejected') {
        const updated = await pool.query<InvitationRow>(
          `UPDATE invitations
           SET status = 'pending', updated_at = NOW()
           WHERE id = $1 AND teacher_id = $2 AND student_email = $3 AND status = 'rejected'
           RETURNING id, teacher_id, student_email, student_id, status, created_at, updated_at`,
          [existingRow.id, teacherId, student.email]
        );
        const updatedRow = updated.rows[0];
        if (!updatedRow) {
          res.status(500).json({ error: 'Failed to update invitation' });
          return;
        }
        res.status(201).json(updatedRow);
        return;
      }
      res.status(409).json({ error: 'Bu öğrenciye zaten davet gönderilmiş' });
      return;
    }

    const insert = await pool.query<InvitationRow>(
      `INSERT INTO invitations (teacher_id, student_email, student_id, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING id, teacher_id, student_email, student_id, status, created_at, updated_at`,
      [teacherId, student.email, student.id]
    );
    const row = insert.rows[0];
    if (!row) {
      res.status(500).json({ error: 'Failed to create invitation' });
      return;
    }
    res.status(201).json(row);
  } catch (err: unknown) {
    if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === '23505') {
      res.status(409).json({ error: 'Zaten bekleyen bir davet var' });
      return;
    }
    console.error('sendInvitation error:', err);
    res.status(500).json({ error: 'Failed to send invitation' });
  }
}

export async function getInvitations(req: Request, res: Response): Promise<void> {
  const teacherId = req.user?.id;
  if (!teacherId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const result = await pool.query<
      InvitationRow & { student_name: string | null }
    >(
      `SELECT i.id, i.teacher_id, i.student_email, i.student_id, i.status, i.created_at, i.updated_at,
              u.name AS student_name
       FROM invitations i
       LEFT JOIN users u ON u.id = i.student_id
       WHERE i.teacher_id = $1
       ORDER BY i.created_at DESC`,
      [teacherId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('getInvitations error:', err);
    res.status(500).json({ error: 'Failed to load invitations' });
  }
}

export async function getIncomingInvitations(req: Request, res: Response): Promise<void> {
  const studentId = req.user?.id;
  if (!studentId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const result = await pool.query<
      InvitationRow & { teacher_name: string | null }
    >(
      `SELECT i.id, i.teacher_id, i.student_email, i.student_id, i.status, i.created_at, i.updated_at,
              u.name AS teacher_name
       FROM invitations i
       LEFT JOIN users u ON u.id = i.teacher_id
       WHERE i.student_id = $1 AND i.status = 'pending'
       ORDER BY i.created_at DESC`,
      [studentId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('getIncomingInvitations error:', err);
    res.status(500).json({ error: 'Failed to load incoming invitations' });
  }
}

export async function getMyTeacher(req: Request, res: Response): Promise<void> {
  const studentId = req.user?.id;
  if (!studentId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const result = await pool.query<{ id: string; name: string | null; email: string | null }>(
      `SELECT u.id, u.name, u.email
       FROM invitations i
       JOIN users u ON u.id = i.teacher_id
       WHERE i.student_id = $1 AND i.status = 'accepted'
       LIMIT 1`,
      [studentId]
    );
    const row = result.rows[0];
    if (!row) {
      res.json({ teacher: null });
      return;
    }
    res.json({
      teacher: {
        id: row.id,
        name: row.name ?? '',
        email: row.email ?? '',
      },
    });
  } catch (err) {
    console.error('getMyTeacher error:', err);
    res.status(500).json({ error: 'Failed to load teacher' });
  }
}

export async function removeStudent(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { studentId } = req.params;
  if (!studentId) {
    res.status(400).json({ error: 'studentId is required' });
    return;
  }

  try {
    let result;
    if (studentId === userId) {
      result = await pool.query(`DELETE FROM invitations WHERE student_id = $1 AND status = 'accepted'`, [
        studentId,
      ]);
    } else {
      result = await pool.query(`DELETE FROM invitations WHERE teacher_id = $1 AND student_id = $2`, [
        userId,
        studentId,
      ]);
    }
    if (!result.rowCount) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.sendStatus(200);
  } catch (err) {
    console.error('removeStudent error:', err);
    res.status(500).json({ error: 'Failed to remove student' });
  }
}

export async function deleteInvitation(req: Request, res: Response): Promise<void> {
  const teacherId = req.user?.id;
  if (!teacherId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { id } = req.params;
  if (!id) {
    res.status(400).json({ error: 'id is required' });
    return;
  }

  try {
    const result = await pool.query(`DELETE FROM invitations WHERE id = $1 AND teacher_id = $2 AND status = 'pending'`, [
      id,
      teacherId,
    ]);
    if (!result.rowCount) {
      res.status(404).json({ error: 'Invitation not found' });
      return;
    }
    res.sendStatus(200);
  } catch (err) {
    console.error('deleteInvitation error:', err);
    res.status(500).json({ error: 'Failed to delete invitation' });
  }
}

export async function respondInvitation(req: Request, res: Response): Promise<void> {
  const studentId = req.user?.id;
  if (!studentId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { id } = req.params;
  if (!id) {
    res.status(400).json({ error: 'id is required' });
    return;
  }

  const body = req.body as { status?: unknown };
  if (body.status !== 'accepted' && body.status !== 'rejected') {
    res.status(400).json({ error: "status must be 'accepted' or 'rejected'" });
    return;
  }

  const status = body.status;

  try {
    const result = await pool.query<InvitationRow>(
      `UPDATE invitations
       SET status = $3, updated_at = NOW()
       WHERE id = $1 AND student_id = $2
       RETURNING id, teacher_id, student_email, student_id, status, created_at, updated_at`,
      [id, studentId, status]
    );
    const row = result.rows[0];
    if (!row) {
      res.status(404).json({ error: 'Invitation not found' });
      return;
    }
    res.status(200).json(row);
  } catch (err) {
    console.error('respondInvitation error:', err);
    res.status(500).json({ error: 'Failed to update invitation' });
  }
}

export async function getStudentStats(req: Request, res: Response): Promise<void> {
  const teacherId = req.user?.id;
  if (!teacherId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { studentId } = req.params;
  if (!studentId) {
    res.status(400).json({ error: 'studentId is required' });
    return;
  }

  try {
    const access = await pool.query(
      `SELECT 1 FROM invitations
       WHERE teacher_id = $1 AND student_id = $2 AND status = 'accepted'
       LIMIT 1`,
      [teacherId, studentId]
    );
    if (!access.rowCount) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const [questionsCount, topicsCount, voiceNotesCount, qReviews, tReviews] = await Promise.all([
      pool.query<{ c: string }>(
        `SELECT COUNT(*)::text AS c FROM questions WHERE user_id = $1 AND (deleted IS NOT TRUE)`,
        [studentId]
      ),
      pool.query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM topics WHERE user_id = $1`, [studentId]),
      pool.query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM voice_notes WHERE user_id = $1`, [studentId]),
      pool.query<{ s: string | null }>(
        `SELECT COALESCE(SUM(review_count), 0)::text AS s FROM questions WHERE user_id = $1 AND (deleted IS NOT TRUE)`,
        [studentId]
      ),
      pool.query<{ s: string | null }>(
        `SELECT COALESCE(SUM(review_count), 0)::text AS s FROM topics WHERE user_id = $1`,
        [studentId]
      ),
    ]);

    const questions = Number(questionsCount.rows[0]?.c ?? 0);
    const topics = Number(topicsCount.rows[0]?.c ?? 0);
    const voiceNotes = Number(voiceNotesCount.rows[0]?.c ?? 0);
    const qr = Number(qReviews.rows[0]?.s ?? 0);
    const tr = Number(tReviews.rows[0]?.s ?? 0);

    res.json({
      questions,
      topics,
      voiceNotes,
      totalReviews: qr + tr,
    });
  } catch (err) {
    console.error('getStudentStats error:', err);
    res.status(500).json({ error: 'Failed to load student stats' });
  }
}

export async function getStudentContent(req: Request, res: Response): Promise<void> {
  const teacherId = req.user?.id;
  if (!teacherId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { studentId } = req.params;
  if (!studentId) {
    res.status(400).json({ error: 'studentId is required' });
    return;
  }

  try {
    const access = await pool.query(
      `SELECT 1 FROM invitations
       WHERE teacher_id = $1 AND student_id = $2 AND status = 'accepted'
       LIMIT 1`,
      [teacherId, studentId]
    );
    if (!access.rowCount) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const [questionsRes, topicsRes, voiceRes] = await Promise.all([
      pool.query(
        `SELECT id, image_url, difficulty, subject, next_review_at
         FROM questions
         WHERE user_id = $1 AND (deleted IS NOT TRUE)
         ORDER BY created_at DESC`,
        [studentId]
      ),
      pool.query(
        `SELECT id, title, notes, next_review_at
         FROM topics
         WHERE user_id = $1
         ORDER BY created_at DESC`,
        [studentId]
      ),
      pool.query(
        `SELECT id, title, duration, created_at
         FROM voice_notes
         WHERE user_id = $1
         ORDER BY created_at DESC`,
        [studentId]
      ),
    ]);

    res.json({
      questions: questionsRes.rows,
      topics: topicsRes.rows,
      voiceNotes: voiceRes.rows,
    });
  } catch (err) {
    console.error('getStudentContent error:', err);
    res.status(500).json({ error: 'Failed to load student content' });
  }
}
