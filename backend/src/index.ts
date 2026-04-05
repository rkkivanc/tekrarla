import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { pool } from './db.js';
import authRouter from './routes/auth.js';
import questionsRouter from './routes/questions.js';
import uploadRouter from './routes/upload.js';
import topicsRouter from './routes/topics.js';
import voiceNotesRouter from './routes/voiceNotes.js';
import invitationsRouter from './routes/invitations.js';

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());

app.get('/', (_req, res) => {
  res.send('Hello from Tekrarla API');
});

app.use('/api/auth', authRouter);
app.use('/api/questions', questionsRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/topics', topicsRouter);
app.use('/api/voice-notes', voiceNotesRouter);
app.use('/api/invitations', invitationsRouter);

async function start() {
  try {
    await pool.query('SELECT 1');
    console.log('DB connected');
  } catch (err) {
    console.error('DB connection error:', err);
  }

  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

void start();
