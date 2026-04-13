import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bell,
  BookOpen,
  Calendar,
  FileQuestion,
  GraduationCap,
  KeyRound,
  Mic,
  Shield,
  Trash2,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { isAxiosError } from 'axios';
import { api } from '../api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

export type AdminUserRow = {
  id: string;
  name: string;
  email: string | null;
  role: string;
  created_at: string;
};

type AdminStats = {
  total_users: number;
  total_teachers: number;
  total_students: number;
  total_questions: number;
  total_topics: number;
  total_voice_notes: number;
  users_reviewed_today: number;
};

type ConfirmRoleAction = {
  userId: string;
  userName: string;
  newRole: 'student' | 'teacher';
};

function roleBadge(role: string) {
  if (role === 'admin') {
    return (
      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300">
        admin
      </span>
    );
  }
  if (role === 'teacher') {
    return (
      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
        teacher
      </span>
    );
  }
  return (
    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300">
      student
    </span>
  );
}

function formatDate(value: string | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function AdminPage() {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [confirmAction, setConfirmAction] = useState<ConfirmRoleAction | null>(null);
  const [resetTarget, setResetTarget] = useState<{ userId: string; userName: string } | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ userId: string; userName: string } | null>(null);
  const [broadcastDialogOpen, setBroadcastDialogOpen] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [broadcastConfirmOpen, setBroadcastConfirmOpen] = useState(false);
  const [notifyTarget, setNotifyTarget] = useState<{ userId: string; userName: string } | null>(null);
  const [notifyTitle, setNotifyTitle] = useState('');
  const [notifyBody, setNotifyBody] = useState('');
  const [notifySending, setNotifySending] = useState(false);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const { data } = await api.get<AdminStats>('/admin/stats');
      setStats(data);
    } catch (err) {
      const msg = isAxiosError(err) ? (err.response?.data as { error?: string })?.error : undefined;
      toast.error(msg ?? 'İstatistikler yüklenemedi');
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<AdminUserRow[]>('/admin/users');
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      const msg = isAxiosError(err) ? (err.response?.data as { error?: string })?.error : undefined;
      toast.error(msg ?? 'Kullanıcılar yüklenemedi');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
    void loadStats();
  }, [loadUsers, loadStats]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const name = (u.name ?? '').toLowerCase();
      const email = (u.email ?? '').toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [users, search]);

  const patchRole = async (id: string, role: 'student' | 'teacher'): Promise<boolean> => {
    setBusyId(id);
    try {
      const { data } = await api.patch<AdminUserRow>(`/admin/users/${id}/role`, { role });
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...data } : u)));
      toast.success('Rol güncellendi');
      return true;
    } catch (err) {
      const msg = isAxiosError(err) ? (err.response?.data as { error?: string })?.error : undefined;
      toast.error(msg ?? 'Rol güncellenemedi');
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const handleConfirmRole = async () => {
    if (!confirmAction) return;
    const ok = await patchRole(confirmAction.userId, confirmAction.newRole);
    if (ok) setConfirmAction(null);
  };

  const handleConfirmResetPassword = async () => {
    if (!resetTarget) return;
    setBusyId(resetTarget.userId);
    try {
      const { data } = await api.patch<{ temporaryPassword: string }>(
        `/admin/users/${resetTarget.userId}/reset-password`,
      );
      setResetTarget(null);
      setTempPassword(data.temporaryPassword);
      toast.success('Şifre sıfırlandı');
    } catch (err) {
      const msg = isAxiosError(err) ? (err.response?.data as { error?: string })?.error : undefined;
      toast.error(msg ?? 'Şifre sıfırlanamadı');
    } finally {
      setBusyId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.userId);
    try {
      await api.delete(`/admin/users/${deleteTarget.userId}`);
      setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.userId));
      setDeleteTarget(null);
      toast.success('Kullanıcı silindi');
    } catch (err) {
      const msg = isAxiosError(err) ? (err.response?.data as { error?: string })?.error : undefined;
      toast.error(msg ?? 'Kullanıcı silinemedi');
    } finally {
      setBusyId(null);
    }
  };

  const handleBroadcastSend = async () => {
    setBroadcastConfirmOpen(false);
    setBroadcastSending(true);
    try {
      const { data } = await api.post<{ sent: number; failed: number }>('/admin/notifications/broadcast', {
        title: broadcastTitle.trim(),
        body: broadcastBody.trim(),
      });
      setBroadcastDialogOpen(false);
      setBroadcastTitle('');
      setBroadcastBody('');
      toast.success(`${data.sent} kullanıcıya gönderildi, ${data.failed} başarısız`);
    } catch (err) {
      const msg = isAxiosError(err) ? (err.response?.data as { error?: string })?.error : undefined;
      toast.error(msg ?? 'Bildirim gönderilemedi');
    } finally {
      setBroadcastSending(false);
    }
  };

  const copyTempPassword = async () => {
    if (!tempPassword) return;
    try {
      await navigator.clipboard.writeText(tempPassword);
      toast.success('Panoya kopyalandı');
    } catch {
      toast.error('Kopyalanamadı');
    }
  };

  const handleSendUserNotification = async () => {
    if (!notifyTarget) return;
    setNotifySending(true);
    try {
      await api.post(`/admin/users/${notifyTarget.userId}/notify`, {
        title: notifyTitle.trim(),
        body: notifyBody.trim(),
      });
      toast.success('Bildirim gönderildi');
      setNotifyTarget(null);
      setNotifyTitle('');
      setNotifyBody('');
    } catch (err) {
      const msg = isAxiosError(err) ? (err.response?.data as { error?: string })?.error : undefined;
      toast.error(msg ?? 'Bildirim gönderilemedi');
    } finally {
      setNotifySending(false);
    }
  };

  const hideDangerForAdminRow = (u: AdminUserRow) => u.role === 'admin';

  const statCards = stats
    ? [
        { label: 'Toplam Kullanıcı', value: stats.total_users, Icon: Users },
        { label: 'Öğretmen', value: stats.total_teachers, Icon: GraduationCap },
        { label: 'Toplam Soru', value: stats.total_questions, Icon: FileQuestion },
        { label: 'Toplam Konu', value: stats.total_topics, Icon: BookOpen },
        { label: 'Ses Notları', value: stats.total_voice_notes, Icon: Mic },
        { label: 'Bugün Tekrar Yapan', value: stats.users_reviewed_today, Icon: Calendar },
      ]
    : [];

  const renderRoleAndActions = (u: AdminUserRow, layout: 'table' | 'card') => {
    const wrapClass = layout === 'table' ? 'flex flex-wrap gap-2 justify-end' : 'flex flex-wrap gap-2';
    const busy = busyId === u.id;
    const hideDanger = hideDangerForAdminRow(u);

    return (
      <div className={wrapClass}>
        {u.role === 'student' && (
          <Button
            type="button"
            size="sm"
            disabled={busy}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => setConfirmAction({ userId: u.id, userName: u.name, newRole: 'teacher' })}
          >
            Öğretmen Yap
          </Button>
        )}
        {u.role === 'teacher' && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={busy}
            className="bg-sky-600 hover:bg-sky-700 text-white"
            onClick={() => setConfirmAction({ userId: u.id, userName: u.name, newRole: 'student' })}
          >
            Öğrenci Yap
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          className="gap-1 h-8 px-2 text-xs"
          onClick={() => {
            setNotifyTarget({ userId: u.id, userName: u.name });
            setNotifyTitle('');
            setNotifyBody('');
          }}
        >
          <Bell className="size-3.5 shrink-0" aria-hidden />
          Bildirim
        </Button>
        {!hideDanger && (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => setResetTarget({ userId: u.id, userName: u.name })}
              className="gap-1"
            >
              <KeyRound className="size-4 shrink-0" aria-hidden />
              Şifre Sıfırla
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => setDeleteTarget({ userId: u.id, userName: u.name })}
              className="gap-1 text-destructive border-destructive/50 hover:bg-destructive/10"
            >
              <Trash2 className="size-4 shrink-0" aria-hidden />
              Sil
            </Button>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-8 h-8 text-primary shrink-0" aria-hidden />
          <h1 className="text-2xl font-semibold tracking-tight">Admin Paneli</h1>
        </div>
      </div>

      {statsLoading ? (
        <p className="text-muted-foreground text-sm">İstatistikler yükleniyor…</p>
      ) : statCards.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {statCards.map(({ label, value, Icon }) => (
            <div key={label} className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center justify-between gap-2">
                <Icon className="size-5 text-muted-foreground shrink-0" aria-hidden />
              </div>
              <p className="text-2xl font-bold mt-2 tabular-nums">{value}</p>
              <p className="text-xs text-muted-foreground mt-1">{label}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium">Toplu Bildirim Gönder</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2 shrink-0"
            onClick={() => setBroadcastDialogOpen(true)}
          >
            <Bell className="size-4 shrink-0" aria-hidden />
            Bildirim Gönder
          </Button>
        </div>
      </div>

      <Input
        type="search"
        placeholder="İsim veya e-posta ile ara…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-md"
        aria-label="Kullanıcı ara"
      />

      {loading ? (
        <p className="text-muted-foreground text-sm">Yükleniyor…</p>
      ) : (
        <>
          <div className="hidden md:block rounded-lg border border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Kullanıcı</th>
                  <th className="px-4 py-3 font-medium">E-posta</th>
                  <th className="px-4 py-3 font-medium">Rol</th>
                  <th className="px-4 py-3 font-medium">Kayıt</th>
                  <th className="px-4 py-3 font-medium text-right">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className="border-t border-border">
                    <td className="px-4 py-3 font-medium">{u.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email ?? '—'}</td>
                    <td className="px-4 py-3">{roleBadge(u.role)}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatDate(u.created_at)}</td>
                    <td className="px-4 py-3 text-right">{renderRoleAndActions(u, 'table')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <p className="p-6 text-center text-muted-foreground text-sm">Kayıt bulunamadı.</p>
            )}
          </div>

          <div className="md:hidden flex flex-col gap-3">
            {filtered.map((u) => (
              <div key={u.id} className="rounded-lg border border-border p-4 space-y-3 bg-card">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{u.name}</p>
                    <p className="text-sm text-muted-foreground break-all">{u.email ?? '—'}</p>
                  </div>
                  {roleBadge(u.role)}
                </div>
                <p className="text-xs text-muted-foreground">Kayıt: {formatDate(u.created_at)}</p>
                {renderRoleAndActions(u, 'card')}
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="text-center text-muted-foreground text-sm py-8">Kayıt bulunamadı.</p>
            )}
          </div>
        </>
      )}

      <AlertDialog
        open={confirmAction !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction
                ? `${confirmAction.userName} kullanıcısını ${
                    confirmAction.newRole === 'teacher' ? 'öğretmen' : 'öğrenci'
                  } yapmak istediğine emin misin?`
                : ''}
            </AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">İptal</AlertDialogCancel>
            <Button type="button" disabled={busyId !== null} onClick={() => void handleConfirmRole()}>
              Onayla
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={resetTarget !== null}
        onOpenChange={(open) => {
          if (!open) setResetTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {resetTarget
                ? `${resetTarget.userName} kullanıcısının şifresi sıfırlanacak. Emin misin?`
                : ''}
            </AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">İptal</AlertDialogCancel>
            <Button type="button" disabled={busyId !== null} onClick={() => void handleConfirmResetPassword()}>
              Onayla
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTarget
                ? `${deleteTarget.userName} kullanıcısı ve TÜM verileri kalıcı olarak silinecek. Bu işlem geri alınamaz. Emin misin?`
                : ''}
            </AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">İptal</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={busyId !== null}
              onClick={() => void handleConfirmDelete()}
            >
              Sil
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={tempPassword !== null}
        onOpenChange={(open) => {
          if (!open) setTempPassword(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Geçici şifre</DialogTitle>
          </DialogHeader>
          <p className="text-sm break-all font-mono bg-muted rounded-md p-3">
            Geçici şifre: {tempPassword}
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => void copyTempPassword()}>
              Kopyala
            </Button>
            <Button type="button" onClick={() => setTempPassword(null)}>
              Tamam
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={notifyTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setNotifyTarget(null);
            setNotifyTitle('');
            setNotifyBody('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {notifyTarget ? `${notifyTarget.userName} kullanıcısına bildirim gönder` : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Başlık"
              value={notifyTitle}
              onChange={(e) => setNotifyTitle(e.target.value)}
              disabled={notifySending}
            />
            <Textarea
              placeholder="Mesaj"
              value={notifyBody}
              onChange={(e) => setNotifyBody(e.target.value)}
              disabled={notifySending}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setNotifyTarget(null);
                setNotifyTitle('');
                setNotifyBody('');
              }}
              disabled={notifySending}
            >
              İptal
            </Button>
            <Button
              type="button"
              disabled={notifySending || !notifyTitle.trim() || !notifyBody.trim()}
              onClick={() => void handleSendUserNotification()}
            >
              Gönder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={broadcastDialogOpen} onOpenChange={setBroadcastDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Toplu bildirim</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Bildirim başlığı"
              value={broadcastTitle}
              onChange={(e) => setBroadcastTitle(e.target.value)}
              disabled={broadcastSending}
            />
            <Textarea
              placeholder="Bildirim mesajı"
              value={broadcastBody}
              onChange={(e) => setBroadcastBody(e.target.value)}
              disabled={broadcastSending}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setBroadcastDialogOpen(false)}>
              İptal
            </Button>
            <Button
              type="button"
              disabled={broadcastSending || !broadcastTitle.trim() || !broadcastBody.trim()}
              onClick={() => setBroadcastConfirmOpen(true)}
            >
              Gönder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={broadcastConfirmOpen} onOpenChange={setBroadcastConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tüm kullanıcılara bildirim gönderilecek. Emin misin?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">İptal</AlertDialogCancel>
            <Button type="button" disabled={broadcastSending} onClick={() => void handleBroadcastSend()}>
              Gönder
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
