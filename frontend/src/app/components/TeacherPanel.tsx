import { useState, useEffect } from 'react';
import {
  Plus,
  Eye,
  Trash2,
  Users,
  FileQuestion,
  BookOpen,
  Mic,
  Clock,
  Send,
  Check,
  X,
} from 'lucide-react';
import type { User } from '../store';
import { api } from '../api';
import { toast } from 'sonner';
import { isAxiosError } from 'axios';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { Button } from './ui/button';

type SelectedStudentPreview = Pick<User, 'id' | 'name' | 'email'>;

function difficultyBadge(difficulty: string | null | undefined) {
  if (difficulty === 'hard') {
    return (
      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-400">
        Zor
      </span>
    );
  }
  if (difficulty === 'medium') {
    return (
      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-400">
        Orta
      </span>
    );
  }
  if (difficulty === 'easy') {
    return (
      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-400">
        Kolay
      </span>
    );
  }
  return (
    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">—</span>
  );
}

function formatReviewDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function truncateText(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function formatDurationMmSs(seconds: number | null | undefined): string {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

function formatVoiceNoteDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function TeacherPanel() {
  const [invitations, setInvitations] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<SelectedStudentPreview | null>(null);
  const [studentStats, setStudentStats] = useState<any | null>(null);
  const [studentContent, setStudentContent] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'stats' | 'questions' | 'topics' | 'voiceNotes'>('stats');
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [inviteIdToCancel, setInviteIdToCancel] = useState<string | null>(null);
  const [removeStudentDialogOpen, setRemoveStudentDialogOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/invitations');
        if (!cancelled) setInvitations(data);
      } catch (err) {
        if (!cancelled) {
          const msg = isAxiosError(err) ? (err.response?.data as { error?: string })?.error : undefined;
          toast.error(msg ?? 'Davetler yüklenemedi');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSendInvite() {
    if (!inviteEmail.trim()) {
      toast.error('E-posta gerekli');
      return;
    }
    try {
      await api.post('/invitations', { student_email: inviteEmail.trim() });
      const { data } = await api.get('/invitations');
      setInvitations(data);
      setInviteEmail('');
      setShowInviteForm(false);
      toast.success('Davet gönderildi');
    } catch (err) {
      const msg = isAxiosError(err) ? (err.response?.data as { error?: string })?.error : undefined;
      toast.error(msg ?? 'Davet gönderilemedi');
    }
  }

  async function handleViewStudent(studentId: string, inv: any) {
    try {
      const [statsRes, contentRes] = await Promise.all([
        api.get(`/invitations/students/${studentId}/stats`),
        api.get(`/invitations/students/${studentId}/content`),
      ]);
      setStudentStats(statsRes.data);
      setStudentContent(contentRes.data);
      setActiveTab('stats');
      setSelectedStudent({
        id: studentId,
        name: inv.student_name ?? 'Öğrenci',
        email: inv.student_email ?? '',
      });
    } catch (err) {
      const msg = isAxiosError(err) ? (err.response?.data as { error?: string })?.error : undefined;
      toast.error(msg ?? 'Öğrenci verileri yüklenemedi');
    }
  }

  function handleBackFromStudent() {
    setSelectedStudent(null);
    setStudentStats(null);
    setStudentContent(null);
    setActiveTab('stats');
  }

  async function handleConfirmCancelInvitation() {
    if (!inviteIdToCancel) return;
    const id = inviteIdToCancel;
    try {
      await api.delete(`/invitations/${id}`);
      setInvitations(prev => prev.filter(inv => inv.id !== id));
      setInviteIdToCancel(null);
      toast.success('Davet iptal edildi');
    } catch (err) {
      const msg = isAxiosError(err) ? (err.response?.data as { error?: string })?.error : undefined;
      toast.error(msg ?? 'Davet iptal edilemedi');
    }
  }

  async function handleConfirmRemoveFromClass() {
    if (!selectedStudent) return;
    const sid = selectedStudent.id;
    try {
      await api.delete(`/invitations/students/${sid}`);
      setSelectedStudent(null);
      setStudentStats(null);
      setStudentContent(null);
      setActiveTab('stats');
      setRemoveStudentDialogOpen(false);
      const { data } = await api.get('/invitations');
      setInvitations(data);
      toast.success('Öğrenci sınıftan çıkarıldı');
    } catch (err) {
      const msg = isAxiosError(err) ? (err.response?.data as { error?: string })?.error : undefined;
      toast.error(msg ?? 'Öğrenci çıkarılamadı');
    }
  }

  function statusBadge(status: string) {
    if (status === 'pending') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-400">
          <Clock className="w-3 h-3 shrink-0" aria-hidden />
          Bekliyor
        </span>
      );
    }
    if (status === 'accepted') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-400">
          <Check className="w-3 h-3 shrink-0" aria-hidden />
          Kabul Edildi
        </span>
      );
    }
    if (status === 'rejected') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-400">
          <Trash2 className="w-3 h-3 shrink-0" aria-hidden />
          Reddedildi
        </span>
      );
    }
    return (
      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{status}</span>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4 pb-20 md:pb-0">
        <div className="flex items-center justify-between">
          <h1>Öğretmen Paneli</h1>
        </div>
        <p className="text-sm text-muted-foreground">Yükleniyor…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <div className="flex items-center justify-between gap-3">
        <h1>Öğretmen Paneli</h1>
        <button
          type="button"
          onClick={() => setShowInviteForm(v => !v)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground shrink-0"
        >
          <Plus className="w-4 h-4" />
          Davet Gönder
        </button>
      </div>

      {showInviteForm && (
        <div className="bg-card rounded-xl border border-border p-5 space-y-4">
          <label className="block text-sm font-medium">Öğrenci e-postası</label>
          <input
            type="email"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            placeholder="ornek@email.com"
            className="w-full px-3 py-2 rounded-lg border border-border bg-input-background"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setShowInviteForm(false);
                setInviteEmail('');
              }}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border border-border"
            >
              <X className="w-4 h-4" />
              İptal
            </button>
            <button
              type="button"
              onClick={() => void handleSendInvite()}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-primary text-primary-foreground"
            >
              <Send className="w-4 h-4" />
              Gönder
            </button>
          </div>
        </div>
      )}

      {selectedStudent ? (
        <div className="bg-card rounded-xl border border-border p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleBackFromStudent}
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              ← Geri
            </button>
          </div>
          <div>
            <h2 className="text-lg font-semibold">{selectedStudent.name}</h2>
            <p className="text-sm text-muted-foreground">{selectedStudent.email}</p>
          </div>

          <div className="flex flex-wrap gap-1 border-b border-border -mx-1 px-1">
            {(
              [
                { id: 'stats' as const, label: 'İstatistikler' },
                { id: 'questions' as const, label: 'Sorular' },
                { id: 'topics' as const, label: 'Konular' },
                { id: 'voiceNotes' as const, label: 'Ses Notları' },
              ] as const
            ).map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-2 text-sm font-medium rounded-t-md border-b-2 -mb-px transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'stats' && studentStats && (
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div className="p-3 rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                <FileQuestion className="w-5 h-5 mb-1" />
                <div className="text-xl font-semibold">{studentStats.questions}</div>
                <div className="text-xs">Soru</div>
              </div>
              <div className="p-3 rounded-lg bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
                <BookOpen className="w-5 h-5 mb-1" />
                <div className="text-xl font-semibold">{studentStats.topics}</div>
                <div className="text-xs">Konu</div>
              </div>
              <div className="p-3 rounded-lg bg-pink-50 text-pink-700 dark:bg-pink-950/40 dark:text-pink-300">
                <Mic className="w-5 h-5 mb-1" />
                <div className="text-xl font-semibold">{studentStats.voiceNotes}</div>
                <div className="text-xs">Ses Kaydı</div>
              </div>
              <div className="p-3 rounded-lg bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300">
                <Clock className="w-5 h-5 mb-1" />
                <div className="text-xl font-semibold">{studentStats.totalReviews}</div>
                <div className="text-xs">Toplam Tekrar</div>
              </div>
            </div>
          )}

          {activeTab === 'questions' && (
            <div className="space-y-3 mt-2">
              {!studentContent?.questions?.length ? (
                <p className="text-sm text-muted-foreground text-center py-8">Henüz soru yok</p>
              ) : (
                studentContent.questions.map((q: any) => (
                  <div key={q.id} className="rounded-xl border border-border overflow-hidden bg-muted/20">
                    <div className="aspect-video bg-muted relative">
                      <img src={q.image_url} alt="" className="w-full h-full object-contain" />
                    </div>
                    <div className="p-3 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {difficultyBadge(q.difficulty)}
                        {q.subject ? (
                          <span className="text-xs text-muted-foreground">{q.subject}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Ders / konu belirtilmemiş</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Sonraki tekrar: {formatReviewDate(q.next_review_at)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'topics' && (
            <div className="space-y-3 mt-2">
              {!studentContent?.topics?.length ? (
                <p className="text-sm text-muted-foreground text-center py-8">Henüz konu yok</p>
              ) : (
                studentContent.topics.map((t: any) => (
                  <div key={t.id} className="rounded-xl border border-border p-4 space-y-2">
                    <div className="font-medium">{t.title}</div>
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {t.notes ? truncateText(t.notes, 100) : 'Not yok'}
                    </p>
                    <p className="text-xs text-muted-foreground">Sonraki tekrar: {formatReviewDate(t.next_review_at)}</p>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'voiceNotes' && (
            <div className="space-y-3 mt-2">
              {!studentContent?.voiceNotes?.length ? (
                <p className="text-sm text-muted-foreground text-center py-8">Henüz ses notu yok</p>
              ) : (
                studentContent.voiceNotes.map((v: any) => (
                  <div key={v.id} className="rounded-xl border border-border p-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div className="font-medium min-w-0 truncate">{v.title}</div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span>{formatDurationMmSs(v.duration)}</span>
                      <span>{formatVoiceNoteDate(v.created_at)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          <Button type="button" variant="destructive" className="w-full sm:w-auto" onClick={() => setRemoveStudentDialogOpen(true)}>
            Sınıftan Çıkar
          </Button>
        </div>
      ) : (
        <>
          {invitations.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center mb-3">
                <Users className="w-8 h-8" />
              </div>
              <p>Henüz davet gönderilmedi</p>
            </div>
          ) : (
            <div className="space-y-3">
              {invitations.map((inv: any) => (
                <div
                  key={inv.id}
                  className="bg-card rounded-xl border border-border p-4 flex items-center gap-3 flex-wrap"
                >
                  <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                    {(inv.student_name || inv.student_email || '?').toString().charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">{inv.student_name || 'Öğrenci'}</div>
                    <div className="text-xs text-muted-foreground truncate">{inv.student_email}</div>
                    <div className="mt-1.5">{statusBadge(inv.status)}</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {inv.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => setInviteIdToCancel(inv.id)}
                        className="px-3 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                      >
                        İptal Et
                      </button>
                    )}
                    {inv.status === 'accepted' && inv.student_id && (
                      <button
                        type="button"
                        onClick={() => void handleViewStudent(inv.student_id, inv)}
                        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                        aria-label="Öğrenciyi görüntüle"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <AlertDialog
        open={inviteIdToCancel !== null}
        onOpenChange={open => {
          if (!open) setInviteIdToCancel(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bu daveti iptal etmek istediğine emin misin?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">İptal</AlertDialogCancel>
            <Button type="button" variant="destructive" onClick={() => void handleConfirmCancelInvitation()}>
              Evet, İptal Et
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={removeStudentDialogOpen}
        onOpenChange={open => {
          setRemoveStudentDialogOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bu öğrenciyi sınıftan çıkarmak istediğine emin misin?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">İptal</AlertDialogCancel>
            <Button type="button" variant="destructive" onClick={() => void handleConfirmRemoveFromClass()}>
              Çıkar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
