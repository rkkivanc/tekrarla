import React from 'react';
import { useState, useRef, useEffect } from 'react';
import { Plus, X, BookOpen, Camera, Calendar } from 'lucide-react';
import type { Topic } from '../store';
import { api } from '../api';
import imageCompression from 'browser-image-compression';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { isAxiosError } from 'axios';

type TopicRow = {
  id: string;
  title: string;
  notes: string | null;
  image_url: string | null;
  created_at: string;
  next_review_at: string | null;
  review_count: number;
  last_result?: string | null;
};

type TopicWithMeta = Topic & { lastResult?: string | null };

function nextReviewAtFromOffsets(days: number, hours: number, minutes: number): string {
  const d0 = Number.isFinite(days) ? Math.floor(days) : 0;
  const h0 = Number.isFinite(hours) ? Math.floor(hours) : 0;
  const m0 = Number.isFinite(minutes) ? Math.floor(minutes) : 0;
  const d = Math.min(365, Math.max(0, d0));
  const h = Math.min(23, Math.max(0, h0));
  const m = Math.min(59, Math.max(0, m0));
  return new Date(Date.now() + d * 86_400_000 + h * 3_600_000 + m * 60_000).toISOString();
}

function rowToTopic(row: TopicRow): TopicWithMeta {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes ?? '',
    imageUrl: row.image_url ?? undefined,
    createdAt: row.created_at,
    nextReviewAt: row.next_review_at ?? new Date().toISOString(),
    reviewCount: row.review_count,
    lastResult: row.last_result ?? undefined,
  };
}

export function TopicsPage() {
  const [topics, setTopics] = useState<TopicWithMeta[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const fileCameraRef = useRef<HTMLInputElement>(null);
  const fileGalleryRef = useRef<HTMLInputElement>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [idToDelete, setIdToDelete] = useState<string | null>(null);
  const [topicDays, setTopicDays] = useState(3);
  const [topicHours, setTopicHours] = useState(0);
  const [topicMinutes, setTopicMinutes] = useState(0);
  const [topicReviewDialogOpen, setTopicReviewDialogOpen] = useState(false);
  const [topicReviewTargetId, setTopicReviewTargetId] = useState<string | null>(null);
  const [topicReviewDays, setTopicReviewDays] = useState(1);
  const [topicReviewHours, setTopicReviewHours] = useState(0);
  const [topicReviewMinutes, setTopicReviewMinutes] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get<TopicRow[]>('/topics');
        if (!cancelled) setTopics(data.map(rowToTopic));
      } catch {
        if (!cancelled) toast.error('Konular yüklenemedi');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleImageUpload = async (file: File) => {
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      });
      const formData = new FormData();
      formData.append('file', compressed, compressed.name || file.name);
      const { data } = await api.post<{ url: string }>('/upload', formData);
      setImageUrl(data.url);
    } catch {
      toast.error('Fotoğraf yüklenemedi');
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error('Başlık gerekli');
      return;
    }
    if (!notes.trim() && !imageUrl) {
      toast.error('Not veya fotoğraf eklemelisiniz');
      return;
    }
    try {
      const next_review_at = nextReviewAtFromOffsets(topicDays, topicHours, topicMinutes);
      const { data } = await api.post<TopicRow>('/topics', {
        title: title.trim(),
        notes: notes.trim(),
        image_url: imageUrl || null,
        next_review_at,
      });
      const newTopic = rowToTopic(data);
      setTopics(prev => [newTopic, ...prev]);
      setShowForm(false);
      setTitle('');
      setNotes('');
      setImageUrl('');
      setTopicDays(3);
      setTopicHours(0);
      setTopicMinutes(0);
      toast.success('Konu notu eklendi!');
    } catch {
      toast.error('Konu kaydedilemedi');
    }
  };

  const openTopicReviewDialog = (topicId: string) => {
    setTopicReviewTargetId(topicId);
    setTopicReviewDays(1);
    setTopicReviewHours(0);
    setTopicReviewMinutes(0);
    setTopicReviewDialogOpen(true);
  };

  const handleSaveTopicReviewDate = async () => {
    if (!topicReviewTargetId) return;
    const d0 = Number.isFinite(topicReviewDays) ? Math.floor(topicReviewDays) : 1;
    const h0 = Number.isFinite(topicReviewHours) ? Math.floor(topicReviewHours) : 0;
    const m0 = Number.isFinite(topicReviewMinutes) ? Math.floor(topicReviewMinutes) : 0;
    const days = Math.min(365, Math.max(0, d0));
    const hours = Math.min(23, Math.max(0, h0));
    const minutes = Math.min(59, Math.max(0, m0));
    try {
      const { data } = await api.patch<TopicRow>(`/topics/${topicReviewTargetId}/review-date`, {
        days,
        hours,
        minutes,
      });
      const updated = rowToTopic(data);
      setTopics(prev => prev.map(x => (x.id === updated.id ? updated : x)));
      setTopicReviewDialogOpen(false);
      setTopicReviewTargetId(null);
      toast.success('Tekrar zamanı güncellendi');
    } catch (e) {
      console.error(e);
      const msg = isAxiosError(e) ? (e.response?.data as { error?: string })?.error : undefined;
      toast.error(msg ?? 'Tekrar zamanı güncellenemedi');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/topics/${id}`);
      setTopics(prev => prev.filter(t => t.id !== id));
      setIdToDelete(null);
      toast.success('Konu silindi');
    } catch {
      toast.error('Konu silinemedi');
    }
  };

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <div className="flex items-center justify-between">
        <h1>Konu Notları</h1>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground">
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'İptal' : 'Konu Ekle'}
        </button>
      </div>

      {showForm && (
        <div className="bg-card rounded-xl border border-border p-5 space-y-4">
          <h3>Yeni Konu Notu</h3>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Konu başlığı" className="w-full px-3 py-2 rounded-lg border border-border bg-input-background" />
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={5} placeholder="Notlarınızı buraya yazın (opsiyonel)..." className="w-full px-3 py-2 rounded-lg border border-border bg-input-background resize-none" />

          {imageUrl ? (
            <div className="relative">
              <img src={imageUrl} alt="Not" className="w-full max-h-48 object-contain rounded-lg border border-border" />
              <button onClick={() => setImageUrl('')} className="absolute top-2 right-2 p-1 rounded-full bg-black/50 text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="w-full py-4 border-2 border-dashed border-border rounded-lg flex flex-col items-center gap-3 text-muted-foreground hover:bg-accent">
              <Camera className="w-5 h-5 md:hidden" />
              <button
                type="button"
                className="hidden md:inline-flex px-4 py-2 rounded-lg border border-border bg-background text-sm text-foreground"
                onClick={() => fileGalleryRef.current?.click()}
              >
                Dosya Seç
              </button>
              <div className="flex md:hidden w-full flex-col sm:flex-row gap-2 px-4">
                <button
                  type="button"
                  className="flex-1 py-2 rounded-lg border border-border bg-background text-sm text-foreground"
                  onClick={() => fileCameraRef.current?.click()}
                >
                  Fotoğraf Çek
                </button>
                <button
                  type="button"
                  className="flex-1 py-2 rounded-lg border border-border bg-background text-sm text-foreground"
                  onClick={() => fileGalleryRef.current?.click()}
                >
                  Galeriden Seç
                </button>
              </div>
            </div>
          )}
          <input
            ref={fileCameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={async e => {
              const file = e.target.files?.[0];
              if (file) await handleImageUpload(file);
              e.target.value = '';
            }}
          />
          <input
            ref={fileGalleryRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async e => {
              const file = e.target.files?.[0];
              if (file) await handleImageUpload(file);
              e.target.value = '';
            }}
          />

          <div className="space-y-2">
            <label className="text-sm text-muted-foreground block">İlk tekrar (şu andan itibaren)</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted-foreground">Gün</span>
                <input
                  type="number"
                  min={0}
                  max={365}
                  value={topicDays}
                  onChange={e => setTopicDays(Number(e.target.value))}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted-foreground">Saat</span>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={topicHours}
                  onChange={e => setTopicHours(Number(e.target.value))}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted-foreground">Dakika</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={topicMinutes}
                  onChange={e => setTopicMinutes(Number(e.target.value))}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </label>
            </div>
          </div>
          <button onClick={() => void handleSubmit()} className="w-full py-3 rounded-lg bg-primary text-primary-foreground">
            Kaydet
          </button>
        </div>
      )}

      {topics.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center mb-3">
            <BookOpen className="w-8 h-8" />
          </div>
          <p>Henüz konu notu eklemediniz</p>
        </div>
      ) : (
        <div className="space-y-3">
          {topics.map(t => (
            <div key={t.id} className="bg-card rounded-xl border border-border overflow-hidden">
              <button onClick={() => setExpandedId(expandedId === t.id ? null : t.id)} className="w-full p-4 text-left flex items-center justify-between">
                <div>
                  <h3>{t.title}</h3>
                  <span className="text-xs text-muted-foreground block">
                    Tekrar: {new Date(t.nextReviewAt).toLocaleDateString('tr-TR')} · {t.reviewCount} tekrar
                    {t.lastResult === 'understood' && (
                      <span className="block mt-0.5">Son tekrar: Anladım ✓</span>
                    )}
                    {t.lastResult === 'not_understood' && (
                      <span className="block mt-0.5">Son tekrar: Anlamadım ✗</span>
                    )}
                  </span>
                </div>
                <BookOpen className="w-5 h-5 text-muted-foreground" />
              </button>
              {expandedId === t.id && (
                <div className="px-4 pb-4 border-t border-border pt-3">
                  <p className="whitespace-pre-wrap text-muted-foreground">{t.notes}</p>
                  {t.imageUrl && <img src={t.imageUrl} alt="Not" className="mt-3 rounded-lg max-h-48 object-contain" />}
                  <div className="mt-3 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => openTopicReviewDialog(t.id)}
                      className="inline-flex items-center justify-center rounded-lg border border-border bg-background p-2 text-foreground hover:bg-accent"
                      aria-label="Tekrar zamanını ayarla"
                    >
                      <Calendar className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => setIdToDelete(t.id)} className="text-sm text-destructive hover:underline">
                      Sil
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={topicReviewDialogOpen}
        onOpenChange={open => {
          setTopicReviewDialogOpen(open);
          if (!open) setTopicReviewTargetId(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tekrar Zamanını Ayarla</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">Gün</span>
              <input
                type="number"
                min={0}
                max={365}
                value={topicReviewDays}
                onChange={e => setTopicReviewDays(Number(e.target.value))}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">Saat</span>
              <input
                type="number"
                min={0}
                max={23}
                value={topicReviewHours}
                onChange={e => setTopicReviewHours(Number(e.target.value))}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">Dakika</span>
              <input
                type="number"
                min={0}
                max={59}
                value={topicReviewMinutes}
                onChange={e => setTopicReviewMinutes(Number(e.target.value))}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTopicReviewDialogOpen(false)}>
              İptal
            </Button>
            <Button type="button" onClick={() => void handleSaveTopicReviewDate()}>
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={idToDelete !== null} onOpenChange={(open) => { if (!open) setIdToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bu konuyu silmek istediğine emin misin?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">İptal</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              onClick={() => idToDelete && void handleDelete(idToDelete)}
            >
              Sil
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
