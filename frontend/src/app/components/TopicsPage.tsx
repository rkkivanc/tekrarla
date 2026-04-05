import { useState, useRef, useEffect } from 'react';
import { Plus, X, BookOpen, Camera } from 'lucide-react';
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

type TopicRow = {
  id: string;
  title: string;
  notes: string | null;
  image_url: string | null;
  created_at: string;
  next_review_at: string | null;
  review_count: number;
};

function rowToTopic(row: TopicRow): Topic {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes ?? '',
    imageUrl: row.image_url ?? undefined,
    createdAt: row.created_at,
    nextReviewAt: row.next_review_at ?? new Date().toISOString(),
    reviewCount: row.review_count,
  };
}

export function TopicsPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [idToDelete, setIdToDelete] = useState<string | null>(null);

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
      const { data } = await api.post<TopicRow>('/topics', {
        title: title.trim(),
        notes: notes.trim(),
        image_url: imageUrl || null,
      });
      const newTopic = rowToTopic(data);
      setTopics(prev => [newTopic, ...prev]);
      setShowForm(false);
      setTitle('');
      setNotes('');
      setImageUrl('');
      toast.success('Konu notu eklendi!');
    } catch {
      toast.error('Konu kaydedilemedi');
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
            <button onClick={() => fileRef.current?.click()} className="w-full py-4 border-2 border-dashed border-border rounded-lg flex items-center justify-center gap-2 text-muted-foreground hover:bg-accent">
              <Camera className="w-5 h-5" /> Fotoğraf ekle (opsiyonel)
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async e => {
              const file = e.target.files?.[0];
              if (file) await handleImageUpload(file);
              e.target.value = '';
            }}
          />

          <p className="text-xs text-muted-foreground">3 gün sonra tekrar bildirimi gönderilecek</p>
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
                  <span className="text-xs text-muted-foreground">
                    Tekrar: {new Date(t.nextReviewAt).toLocaleDateString('tr-TR')} · {t.reviewCount} tekrar
                  </span>
                </div>
                <BookOpen className="w-5 h-5 text-muted-foreground" />
              </button>
              {expandedId === t.id && (
                <div className="px-4 pb-4 border-t border-border pt-3">
                  <p className="whitespace-pre-wrap text-muted-foreground">{t.notes}</p>
                  {t.imageUrl && <img src={t.imageUrl} alt="Not" className="mt-3 rounded-lg max-h-48 object-contain" />}
                  <button type="button" onClick={() => setIdToDelete(t.id)} className="mt-3 text-sm text-destructive hover:underline">
                    Sil
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

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
