import 'dotenv/config';
import cors from 'cors';
import helmet from 'helmet';
import cron from 'node-cron';
import express from 'express';
import { pool } from './db.js';
import authRouter from './routes/auth.js';
import invitationsRouter from './routes/invitations.js';
import notificationsRouter from './routes/notifications.js';
import questionsRouter from './routes/questions.js';
import settingsRouter from './routes/settings.js';
import subjectsRouter from './routes/subjects.js';
import topicsRouter from './routes/topics.js';
import uploadRouter from './routes/upload.js';
import voiceNotesRouter from './routes/voiceNotes.js';
import adminRouter from './routes/admin.js';
import { requireAuth, requireAdmin } from './middleware/auth.js';
import { authLimiter, contentLimiter } from './middleware/rateLimiter.js';
import { sendDailyNotifications } from './services/pushService.js';

const app = express();
app.set('trust proxy', 1);
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

const allowedOrigins = [
  'https://tekrarla.pages.dev',
  'https://tekrarla.app',
  'https://www.tekrarla.app',
];

if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.push('http://localhost:5173');
}

app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' }, crossOriginOpenerPolicy: false }));
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));

app.get('/', (_req, res) => {
  res.send('Hello from Tekrarla API');
});

app.post('/api/questions', contentLimiter);
app.post('/api/topics', contentLimiter);
app.post('/api/voice-notes', contentLimiter);
app.post('/api/upload', contentLimiter);

app.use('/api/auth', authLimiter, authRouter);
app.use('/api/questions', requireAuth, questionsRouter);
app.use('/api/subjects', requireAuth, subjectsRouter);
app.use('/api/settings', requireAuth, settingsRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/topics', requireAuth, topicsRouter);
app.use('/api/voice-notes', requireAuth, voiceNotesRouter);
app.use('/api/invitations', requireAuth, invitationsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/admin', requireAuth, requireAdmin, adminRouter);

cron.schedule('* * * * *', () => {
  void sendDailyNotifications();
});

async function start() {
  try {
    await pool.query('SELECT 1');
    console.log('DB connected');
  } catch (err) {
    console.error('DB connection error:', err);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on port ${port}`);
  });
}

void start();
