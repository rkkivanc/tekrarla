import React from 'react';
import { useMemo, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { FileQuestion, BookOpen, Mic, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { isDueForReview, type User } from '../store';
import { api } from '../api';
import { toast } from 'sonner';
import { isAxiosError } from 'axios';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { Button } from './ui/button';

type MyTeacher = { id: string; name: string; email: string };

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer.slice(outputArray.byteOffset, outputArray.byteOffset + outputArray.byteLength);
}

export function Dashboard() {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<any[]>([]);
  const [topics, setTopics] = useState<any[]>([]);
  const [voiceNotes, setVoiceNotes] = useState<any[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<any[]>([]);
  const [invitationDialog, setInvitationDialog] = useState<
    null | { mode: 'accept' | 'reject'; id: string; teacherName: string }
  >(null);
  const [invitationDialogOpen, setInvitationDialogOpen] = useState(false);
  const invitationDialogCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [myTeacher, setMyTeacher] = useState<MyTeacher | null>(null);
  const [leaveClassDialogOpen, setLeaveClassDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notificationTime, setNotificationTime] = useState('09:00');
  const [hasSubscription, setHasSubscription] = useState(false);
  const [notifLoading, setNotifLoading] = useState(true);

  function openInvitationDialog(payload: { mode: 'accept' | 'reject'; id: string; teacherName: string }) {
    if (invitationDialogCloseTimer.current) {
      clearTimeout(invitationDialogCloseTimer.current);
      invitationDialogCloseTimer.current = null;
    }
    setInvitationDialog(payload);
    setInvitationDialogOpen(true);
  }
  const [user] = useState<User | null>(() => {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [qRes, tRes, vRes] = await Promise.all([
          api.get('/questions'),
          api.get('/topics'),
          api.get('/voice-notes'),
        ]);
        if (cancelled) return;
        setQuestions(qRes.data ?? []);
        setTopics(tRes.data ?? []);
        setVoiceNotes(vRes.data ?? []);
        try {
          const invRes = await api.get('/invitations/incoming');
          if (!cancelled) setPendingInvitations(invRes.data ?? []);
        } catch {
          if (!cancelled) setPendingInvitations([]);
        }
        try {
          const teacherRes = await api.get<{ teacher: MyTeacher | null }>('/invitations/my-teacher');
          if (!cancelled) setMyTeacher(teacherRes.data?.teacher ?? null);
        } catch {
          if (!cancelled) setMyTeacher(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<{ notificationTime: string | null; hasSubscription: boolean }>(
          '/notifications/settings',
        );
        if (cancelled) return;
        if (res.data.notificationTime) {
          setNotificationTime(res.data.notificationTime);
        }
        setHasSubscription(res.data.hasSubscription);
      } catch {
        if (!cancelled) {
          setHasSubscription(false);
        }
      } finally {
        if (!cancelled) setNotifLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (invitationDialogCloseTimer.current) clearTimeout(invitationDialogCloseTimer.current);
    };
  }, []);

  const stats = useMemo(() => {
    const activeQuestions = questions.filter(q => !q.deleted);
    const dueQuestions = activeQuestions.filter(q => isDueForReview(q.next_review_at));
    const dueTopics = topics.filter(t => isDueForReview(t.next_review_at));
    const solvedQuestions = activeQuestions.filter(q => q.solved);
    const totalReviews =
      activeQuestions.reduce((sum, q) => sum + (q.review_count ?? 0), 0) +
      topics.reduce((sum, t) => sum + (t.review_count ?? 0), 0);

    return {
      totalQuestions: activeQuestions.length,
      dueQuestions: dueQuestions.length,
      totalTopics: topics.length,
      dueTopics: dueTopics.length,
      totalVoiceNotes: voiceNotes.length,
      solvedQuestions: solvedQuestions.length,
      totalReviews,
      hard: activeQuestions.filter(q => q.difficulty === 'hard').length,
      medium: activeQuestions.filter(q => q.difficulty === 'medium').length,
      easy: activeQuestions.filter(q => q.difficulty === 'easy').length,
    };
  }, [questions, topics, voiceNotes]);

  const totalDue = stats.dueQuestions + stats.dueTopics;

  async function handleInvitationResponse(invitationId: string, status: 'accepted' | 'rejected') {
    try {
      await api.patch(`/invitations/${invitationId}`, { status });
      setPendingInvitations(prev => prev.filter(inv => inv.id !== invitationId));
      toast.success(status === 'accepted' ? 'Davet kabul edildi' : 'Davet reddedildi');
      if (status === 'accepted') {
        try {
          const teacherRes = await api.get<{ teacher: MyTeacher | null }>('/invitations/my-teacher');
          setMyTeacher(teacherRes.data?.teacher ?? null);
        } catch {
          /* ignore */
        }
      }
    } catch (err) {
      const msg = isAxiosError(err) ? (err.response?.data as { error?: string })?.error : undefined;
      toast.error(msg ?? 'İşlem başarısız');
    }
  }

  const notificationsSupported =
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window;

  async function requestNotificationPermission() {
    if (!notificationsSupported) {
      toast.error('Bu tarayıcı bildirimleri desteklemiyor');
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        toast.error('Bildirim izni verilmedi');
        return;
      }
      const vapidRes = await api.get<{ publicKey: string }>('/notifications/vapid-public-key');
      const publicKey = vapidRes.data.publicKey;
      if (!publicKey) {
        toast.error('Bildirim anahtarı alınamadı');
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      await api.post('/notifications/subscribe', { subscription: subscription.toJSON() });
      setHasSubscription(true);
      toast.success('Bildirimler etkinleştirildi');
    } catch (err) {
      const msg = isAxiosError(err) ? (err.response?.data as { error?: string })?.error : undefined;
      toast.error(msg ?? 'Bildirimler etkinleştirilemedi');
    }
  }

  async function updateNotificationTime() {
    try {
      await api.patch('/notifications/time', { notification_time: notificationTime });
      toast.success('Bildirim saati güncellendi');
    } catch (err) {
      const msg = isAxiosError(err) ? (err.response?.data as { error?: string })?.error : undefined;
      toast.error(msg ?? 'Saat güncellenemedi');
    }
  }

  async function disableNotifications() {
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      await sub?.unsubscribe();
      await api.delete('/notifications/subscribe');
      setHasSubscription(false);
      toast.success('Bildirimler kapatıldı');
    } catch (err) {
      const msg = isAxiosError(err) ? (err.response?.data as { error?: string })?.error : undefined;
      toast.error(msg ?? 'Bildirimler kapatılamadı');
    }
  }

  async function handleConfirmLeaveClass() {
    const myId = user?.id;
    if (!myId) return;
    try {
      await api.delete(`/invitations/students/${myId}`);
      setMyTeacher(null);
      setLeaveClassDialogOpen(false);
      toast.success('Sınıftan ayrıldın');
    } catch (err) {
      const msg = isAxiosError(err) ? (err.response?.data as { error?: string })?.error : undefined;
      toast.error(msg ?? 'İşlem başarısız');
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 pb-20 md:pb-0">
        <p className="text-muted-foreground">Yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div>
        <h1 className="text-2xl">Hoş geldin, {user?.name ?? '…'} 👋</h1>
        <p className="text-muted-foreground mt-1">Bugün tekrar etmen gereken {totalDue} öğe var.</p>
      </div>

      {/* Due alert */}
      {totalDue > 0 && (
        <button
          onClick={() => navigate('/review')}
          className="w-full flex items-center gap-4 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 hover:bg-amber-100 transition-colors"
        >
          <AlertTriangle className="w-8 h-8 text-amber-500 shrink-0" />
          <div className="text-left">
            <div className="text-lg">Tekrar Zamanı!</div>
            <div className="text-sm opacity-80">{stats.dueQuestions} soru ve {stats.dueTopics} konu tekrar bekliyor</div>
          </div>
        </button>
      )}

      {pendingInvitations.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Davet Bildirimleri</h2>
          <div className="space-y-3">
            {pendingInvitations.map((inv: any) => (
              <div
                key={inv.id}
                className="bg-card rounded-xl border border-border p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <p className="text-sm sm:text-base">
                  <span className="font-medium">{inv.teacher_name ?? 'Öğretmen'}</span> sizi sınıfına davet etti
                </p>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      openInvitationDialog({
                        mode: 'accept',
                        id: inv.id,
                        teacherName: inv.teacher_name ?? 'Öğretmen',
                      })
                    }
                    className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
                  >
                    Kabul Et
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      openInvitationDialog({
                        mode: 'reject',
                        id: inv.id,
                        teacherName: inv.teacher_name ?? 'Öğretmen',
                      })
                    }
                    className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
                  >
                    Reddet
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {myTeacher && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Öğretmenim</h2>
          <div className="bg-card rounded-xl border border-border p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-slate-800 text-white flex items-center justify-center text-sm font-semibold shrink-0">
                {(myTeacher.name || '?').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="font-medium truncate">{myTeacher.name || 'Öğretmen'}</div>
                <div className="text-sm text-muted-foreground truncate">{myTeacher.email}</div>
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" className="shrink-0 w-full sm:w-auto" onClick={() => setLeaveClassDialogOpen(true)}>
              Sınıftan Ayrıl
            </Button>
          </div>
        </div>
      )}

      <AlertDialog
        open={invitationDialogOpen}
        onOpenChange={(open) => {
          setInvitationDialogOpen(open);
          if (!open) {
            invitationDialogCloseTimer.current = setTimeout(() => {
              invitationDialogCloseTimer.current = null;
              setInvitationDialog(null);
            }, 250);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {invitationDialog?.mode === 'accept'
                ? 'Bu daveti kabul etmek istediğine emin misin?'
                : 'Bu daveti reddetmek istediğine emin misin?'}
            </AlertDialogTitle>
            {invitationDialog?.mode === 'accept' && (
              <AlertDialogDescription>
                {invitationDialog.teacherName} sınıfına katılacaksın
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              className={
                invitationDialog?.mode === 'accept'
                  ? 'bg-green-600 text-white hover:bg-green-700 focus-visible:ring-green-600'
                  : 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600'
              }
              onClick={() => {
                if (!invitationDialog) return;
                void handleInvitationResponse(
                  invitationDialog.id,
                  invitationDialog.mode === 'accept' ? 'accepted' : 'rejected',
                );
              }}
            >
              {invitationDialog?.mode === 'accept' ? 'Kabul Et' : 'Reddet'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={leaveClassDialogOpen} onOpenChange={setLeaveClassDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sınıftan ayrılmak istediğine emin misin?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">İptal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600"
              onClick={() => void handleConfirmLeaveClass()}
            >
              Ayrıl
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={FileQuestion} label="Toplam Soru" value={stats.totalQuestions} color="bg-blue-50 text-blue-700" />
        <StatCard icon={CheckCircle} label="Çözülen" value={stats.solvedQuestions} color="bg-green-50 text-green-700" />
        <StatCard icon={BookOpen} label="Konu Notu" value={stats.totalTopics} color="bg-purple-50 text-purple-700" />
        <StatCard icon={Mic} label="Ses Kaydı" value={stats.totalVoiceNotes} color="bg-pink-50 text-pink-700" />
      </div>

      {/* Difficulty breakdown */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h2 className="mb-4">Zorluk Dağılımı</h2>
        <div className="space-y-3">
          <DifficultyBar label="Zor" count={stats.hard} total={stats.totalQuestions} color="bg-red-500" />
          <DifficultyBar label="Orta" count={stats.medium} total={stats.totalQuestions} color="bg-amber-500" />
          <DifficultyBar label="Kolay" count={stats.easy} total={stats.totalQuestions} color="bg-green-500" />
        </div>
      </div>

      {/* Activity */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h2 className="mb-2">Genel İstatistikler</h2>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-muted-foreground" />
            <div>
              <div className="text-2xl">{stats.totalReviews}</div>
              <div className="text-sm text-muted-foreground">Toplam Tekrar</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <div>
              <div className="text-2xl">{totalDue}</div>
              <div className="text-sm text-muted-foreground">Bekleyen Tekrar</div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-5">
        <h2 className="mb-4">Bildirim Ayarları</h2>
        {notifLoading ? (
          <p className="text-sm text-muted-foreground">Yükleniyor…</p>
        ) : !notificationsSupported ? (
          <p className="text-sm text-muted-foreground">Bu tarayıcı bildirimleri desteklemiyor</p>
        ) : !hasSubscription ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Tekrar zamanı geldiğinde bildirim al</p>
            <Button type="button" onClick={() => void requestNotificationPermission()}>
              Bildirimleri Etkinleştir
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm font-medium text-green-700 dark:text-green-400">Bildirimler aktif ✓</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted-foreground">Günlük hatırlatma saati</span>
                <input
                  type="time"
                  value={notificationTime}
                  onChange={e => setNotificationTime(e.target.value)}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => void updateNotificationTime()}>
                  Kaydet
                </Button>
                <Button type="button" variant="outline" onClick={() => void disableNotifications()}>
                  Bildirimleri Kapat
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <QuickAction icon={FileQuestion} label="Soru Ekle" onClick={() => navigate('/questions')} />
        <QuickAction icon={BookOpen} label="Konu Ekle" onClick={() => navigate('/topics')} />
        <QuickAction icon={Mic} label="Ses Kaydet" onClick={() => navigate('/voice-notes')} />
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <div className={`rounded-xl p-4 ${color}`}>
      <Icon className="w-6 h-6 mb-2" />
      <div className="text-2xl">{value}</div>
      <div className="text-sm opacity-80">{label}</div>
    </div>
  );
}

function DifficultyBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-12 text-sm">{label}</span>
      <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-sm text-right text-muted-foreground">{count}</span>
    </div>
  );
}

function QuickAction({ icon: Icon, label, onClick }: { icon: any; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border hover:bg-accent transition-colors">
      <Icon className="w-5 h-5" />
      <span>{label}</span>
    </button>
  );
}
