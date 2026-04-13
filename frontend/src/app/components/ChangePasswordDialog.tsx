import React, { useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import { toast } from 'sonner';
import { api } from '../api';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Input } from './ui/input';

export type ChangePasswordFormProps = {
  onSuccess: () => void;
  /** When false, clears fields (e.g. dialog closed). */
  active?: boolean;
};

export function ChangePasswordForm({ onSuccess, active = true }: ChangePasswordFormProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!active) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSaving(false);
    }
  }, [active]);

  const passwordsMismatch =
    confirmPassword.length > 0 && newPassword !== confirmPassword;

  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length >= 6 &&
    newPassword === confirmPassword;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword || newPassword.length < 6) {
      return;
    }
    setSaving(true);
    try {
      await api.patch('/auth/change-password', { currentPassword, newPassword });
      localStorage.removeItem('forcePasswordChange');
      onSuccess();
    } catch (err) {
      const msg = isAxiosError(err)
        ? (err.response?.data as { error?: string })?.error
        : undefined;
      toast.error(msg ?? 'Şifre güncellenemedi');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="grid gap-4 w-full max-w-md">
      <div className="grid gap-4 py-2">
        <Input
          type="password"
          placeholder="Mevcut şifreniz"
          value={currentPassword}
          onChange={e => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
          disabled={saving}
        />
        <Input
          type="password"
          placeholder="Yeni şifre (min 6 karakter)"
          value={newPassword}
          onChange={e => setNewPassword(e.target.value)}
          autoComplete="new-password"
          disabled={saving}
        />
        <Input
          type="password"
          placeholder="Yeni şifre tekrar"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          disabled={saving}
        />
        {passwordsMismatch && (
          <p className="text-sm text-red-600 dark:text-red-400">Şifreler eşleşmiyor</p>
        )}
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={saving || !canSubmit}>
          {saving ? 'Kaydediliyor…' : 'Kaydet'}
        </Button>
      </div>
    </form>
  );
}

type ChangePasswordDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ChangePasswordDialog({ open, onOpenChange }: ChangePasswordDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Şifre Değiştir</DialogTitle>
        </DialogHeader>
        <ChangePasswordForm
          active={open}
          onSuccess={() => {
            toast.success('Şifre güncellendi');
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
