import { useCallback, useEffect, useMemo, useState } from 'react';
import { Shield } from 'lucide-react';
import { toast } from 'sonner';
import { isAxiosError } from 'axios';
import { api } from '../api';
import { Button } from './ui/button';
import { Input } from './ui/input';

export type AdminUserRow = {
  id: string;
  name: string;
  email: string | null;
  role: string;
  created_at: string;
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
  }, [loadUsers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const name = (u.name ?? '').toLowerCase();
      const email = (u.email ?? '').toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [users, search]);

  const patchRole = async (id: string, role: 'student' | 'teacher') => {
    setBusyId(id);
    try {
      const { data } = await api.patch<AdminUserRow>(`/admin/users/${id}/role`, { role });
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...data } : u)));
      toast.success('Rol güncellendi');
    } catch (err) {
      const msg = isAxiosError(err) ? (err.response?.data as { error?: string })?.error : undefined;
      toast.error(msg ?? 'Rol güncellenemedi');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-8 h-8 text-primary shrink-0" aria-hidden />
          <h1 className="text-2xl font-semibold tracking-tight">Admin Paneli</h1>
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
          {/* Desktop table */}
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
                    <td className="px-4 py-3 text-right">
                      {u.role === 'student' && (
                        <Button
                          type="button"
                          size="sm"
                          disabled={busyId === u.id}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => void patchRole(u.id, 'teacher')}
                        >
                          Öğretmen Yap
                        </Button>
                      )}
                      {u.role === 'teacher' && (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={busyId === u.id}
                          className="bg-sky-600 hover:bg-sky-700 text-white"
                          onClick={() => void patchRole(u.id, 'student')}
                        >
                          Öğrenci Yap
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <p className="p-6 text-center text-muted-foreground text-sm">Kayıt bulunamadı.</p>
            )}
          </div>

          {/* Mobile cards */}
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
                {u.role === 'student' && (
                  <Button
                    type="button"
                    size="sm"
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                    disabled={busyId === u.id}
                    onClick={() => void patchRole(u.id, 'teacher')}
                  >
                    Öğretmen Yap
                  </Button>
                )}
                {u.role === 'teacher' && (
                  <Button
                    type="button"
                    size="sm"
                    className="w-full bg-sky-600 hover:bg-sky-700 text-white"
                    disabled={busyId === u.id}
                    onClick={() => void patchRole(u.id, 'student')}
                  >
                    Öğrenci Yap
                  </Button>
                )}
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="text-center text-muted-foreground text-sm py-8">Kayıt bulunamadı.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
