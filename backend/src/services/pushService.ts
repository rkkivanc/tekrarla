import webpush from 'web-push';
import type { PushSubscription } from 'web-push';
import { pool } from '../db.js';

const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;

if (publicKey && privateKey) {
  webpush.setVapidDetails('mailto:kagan@tekrarla.app', publicKey, privateKey);
}

/** Şu anki anın UTC saati HH:MM (notification_time DB’de UTC olarak saklanıyor). */
function currentUtcHHMM(): string {
  const d = new Date();
  const h = String(d.getUTCHours()).padStart(2, '0');
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export async function sendPushNotification(
  subscription: PushSubscription,
  title: string,
  body: string
): Promise<void> {
  if (!publicKey || !privateKey) {
    return;
  }
  const payload = JSON.stringify({ title, body });
  try {
    await webpush.sendNotification(subscription, payload);
    console.log('Push sent successfully to:', subscription.endpoint.substring(0, 50));
  } catch (error: any) {
    console.error('Push failed:', error.statusCode, error.body, subscription.endpoint.substring(0, 50));
    throw error;
  }
}

export async function sendDailyNotifications(): Promise<void> {
  console.log('sendDailyNotifications running at', new Date().toISOString());

  if (!publicKey || !privateKey) {
    return;
  }

  try {
    const usersResult = await pool.query<{
      id: string;
      user_id: string;
      notification_time: unknown;
      subscription: unknown;
    }>(
      `SELECT u.id, u.id AS user_id, u.notification_time, ps.subscription
       FROM users u
       INNER JOIN push_subscriptions ps ON ps.user_id = u.id
       WHERE u.notification_time IS NOT NULL`
    );

    const users = usersResult.rows;
    console.log('Found users to notify:', users.length);

    for (const row of users) {
      const dbTime = (row.notification_time as string).substring(0, 5);
      if (dbTime !== currentUtcHHMM()) continue;

      const sub = row.subscription as PushSubscription;
      if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
        continue;
      }

      const [qRes, tRes] = await Promise.all([
        pool.query<{ c: string }>(
          `SELECT COUNT(*)::text AS c
           FROM questions
           WHERE user_id = $1
             AND deleted = false
             AND next_review_at IS NOT NULL
             AND next_review_at <= NOW()`,
          [row.id]
        ),
        pool.query<{ c: string }>(
          `SELECT COUNT(*)::text AS c
           FROM topics
           WHERE user_id = $1
             AND next_review_at IS NOT NULL
             AND next_review_at <= NOW()`,
          [row.id]
        ),
      ]);

      const dueQuestions = Number(qRes.rows[0]?.c ?? 0);
      const dueTopics = Number(tRes.rows[0]?.c ?? 0);
      const total = dueQuestions + dueTopics;

      if (total <= 0) {
        continue;
      }

      const title = 'Tekrarla';
      const body = `${dueQuestions} soru, ${dueTopics} konu tekrarı bekliyor.`;

      try {
        await sendPushNotification(sub, title, body);
        console.log('Push sent to user:', row.user_id);
      } catch (err) {
        console.error('sendDailyNotifications push error:', row.id, err);
      }
    }
  } catch (err) {
    console.error('sendDailyNotifications error:', err);
  }
}
