import React from 'react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Calendar, Camera, Plus, X } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { type Question, getNextReviewDate } from '../store';
import { api } from '../api';
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

type DifficultySettings = { hard: number; medium: number; easy: number };

const DEFAULT_DIFFICULTY_SETTINGS: DifficultySettings = { hard: 1, medium: 3, easy: 5 };

function nextReviewAtFromDays(days: number): string {
  const d0 = Number.isFinite(days) ? Math.floor(days) : 0;
  const d = Math.min(365, Math.max(0, d0));
  return new Date(Date.now() + d * 86400000).toISOString();
}

type QuestionApiRow = {
  id: string;
  image_url: string;
  answer_image_url: string | null;
  answer_text: string | null;
  difficulty: string;
  subject: string | null;
  created_at: string;
  next_review_at: string | null;
  review_count: number;
  solved: boolean;
  deleted: boolean;
  last_result?: string | null;
};

type QuestionWithMeta = Question & { lastResult?: string | null };

function mapRowToQuestion(row: QuestionApiRow): QuestionWithMeta {
  return {
    id: row.id,
    imageUrl: row.image_url,
    answerImageUrl: row.answer_image_url ?? undefined,
    answerText: row.answer_text ?? undefined,
    difficulty: row.difficulty as Question['difficulty'],
    subject: row.subject ?? undefined,
    createdAt: row.created_at,
    nextReviewAt: row.next_review_at ?? new Date().toISOString(),
    reviewCount: row.review_count,
    solved: row.solved,
    deleted: row.deleted,
    lastResult: row.last_result ?? undefined,
  };
}

export function QuestionsPage() {
  const [questions, setQuestions] = useState<QuestionWithMeta[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [questionImg, setQuestionImg] = useState('');
  const [answerImg, setAnswerImg] = useState('');
  const [answerText, setAnswerText] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard' | 'custom'>('medium');
  const [customDays, setCustomDays] = useState(1);
  const [subject, setSubject] = useState('');
  const [answerType, setAnswerType] = useState<'text' | 'image'>('text');
  const qCameraRef = useRef<HTMLInputElement>(null);
  const qGalleryRef = useRef<HTMLInputElement>(null);
  const aCameraRef = useRef<HTMLInputElement>(null);
  const aGalleryRef = useRef<HTMLInputElement>(null);
  const [idToDelete, setIdToDelete] = useState<string | null>(null);
  const [difficultySettings, setDifficultySettings] = useState<DifficultySettings>(DEFAULT_DIFFICULTY_SETTINGS);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewTargetId, setReviewTargetId] = useState<string | null>(null);
  const [reviewDays, setReviewDays] = useState(1);

  const refreshQuestions = useCallback(async () => {
    try {
      const { data } = await api.get<QuestionApiRow[]>('/questions');
      setQuestions(data.map(mapRowToQuestion));
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    refreshQuestions();
  }, [refreshQuestions]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get<DifficultySettings>('/settings/difficulty');
        if (!cancelled && data && typeof data.hard === 'number' && typeof data.medium === 'number' && typeof data.easy === 'number') {
          setDifficultySettings(data);
        }
      } catch {
        if (!cancelled) setDifficultySettings(DEFAULT_DIFFICULTY_SETTINGS);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleImageUpload = async (file: File, setter: (url: string) => void) => {
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 0.3,
        maxWidthOrHeight: 1200,
        useWebWorker: true,
      });
      const formData = new FormData();
      formData.append('file', compressed, compressed.name || file.name);
      const { data } = await api.post<{ url: string }>('/upload', formData);
      setter(data.url);
    } catch (e) {
      console.error(e);
      toast.error('Yükleme başarısız');
    }
  };

  const handleSubmit = async () => {
    if (!questionImg) { toast.error('Lütfen soru fotoğrafı yükleyin'); return; }
    if (answerType === 'text' && !answerText.trim()) { toast.error('Lütfen cevap yazın'); return; }
    if (answerType === 'image' && !answerImg) { toast.error('Lütfen cevap fotoğrafı yükleyin'); return; }

    try {
      const next_review_at =
        difficulty === 'custom'
          ? nextReviewAtFromDays(customDays)
          : getNextReviewDate(difficulty, difficultySettings);
      await api.post('/questions', {
        image_url: questionImg,
        answer_image_url: answerImg,
        answer_text: answerText,
        difficulty,
        subject,
        next_review_at,
      });
      await refreshQuestions();
      setShowForm(false);
      setQuestionImg('');
      setAnswerImg('');
      setAnswerText('');
      setSubject('');
      setDifficulty('medium');
      setCustomDays(1);
      toast.success('Soru eklendi! Tekrar tarihi belirlendi.');
    } catch (e) {
      console.error(e);
      toast.error('Soru kaydedilemedi');
    }
  };

  const openReviewDialog = (questionId: string) => {
    setReviewTargetId(questionId);
    setReviewDays(1);
    setReviewDialogOpen(true);
  };

  const handleSaveReviewDate = async () => {
    if (!reviewTargetId) return;
    const d0 = Number.isFinite(reviewDays) ? Math.floor(reviewDays) : 1;
    const days = Math.min(365, Math.max(0, d0));
    try {
      const { data } = await api.patch<QuestionApiRow>(`/questions/${reviewTargetId}/review-date`, {
        days,
        hours: 0,
        minutes: 0,
      });
      const updated = mapRowToQuestion(data);
      setQuestions(prev => prev.map(q => (q.id === updated.id ? updated : q)));
      setReviewDialogOpen(false);
      setReviewTargetId(null);
      toast.success('Tekrar zamanı güncellendi');
    } catch (e) {
      console.error(e);
      const msg = isAxiosError(e) ? (e.response?.data as { error?: string })?.error : undefined;
      toast.error(msg ?? 'Tekrar zamanı güncellenemedi');
    }
  };

  const handleDeleteQuestion = async (id: string) => {
    try {
      await api.delete(`/questions/${id}`);
      setQuestions(prev => prev.filter(q => q.id !== id));
      setIdToDelete(null);
    } catch (e) {
      console.error(e);
      toast.error('Soru silinemedi');
    }
  };

  const difficultyLabel = {
    easy: `Kolay (${difficultySettings.easy} gün)`,
    medium: `Orta (${difficultySettings.medium} gün)`,
    hard: `Zor (${difficultySettings.hard} gün)`,
    custom: 'Özel aralık',
  } as const;
  const difficultyColor = {
    easy: 'bg-green-100 text-green-800 border-green-300',
    medium: 'bg-amber-100 text-amber-800 border-amber-300',
    hard: 'bg-red-100 text-red-800 border-red-300',
    custom: 'bg-slate-100 text-slate-800 border-slate-300',
  };

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <div className="flex items-center justify-between">
        <h1>Sorularım</h1>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground">
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'İptal' : 'Soru Ekle'}
        </button>
      </div>

      {showForm && (
        <div className="bg-card rounded-xl border border-border p-5 space-y-4">
          <h3>Yeni Soru Ekle</h3>

          {/* Question image */}
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Soru Fotoğrafı *</label>
            {questionImg ? (
              <div className="relative">
                <img src={questionImg} alt="Soru" className="w-full max-h-64 object-contain rounded-lg border border-border" />
                <button onClick={() => setQuestionImg('')} className="absolute top-2 right-2 p-1 rounded-full bg-black/50 text-white"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <div className="w-full py-8 border-2 border-dashed border-border rounded-lg flex flex-col items-center gap-3 hover:bg-accent transition-colors">
                <Camera className="w-8 h-8 text-muted-foreground md:hidden" />
                <button
                  type="button"
                  className="hidden md:inline-flex px-4 py-2 rounded-lg border border-border bg-background text-sm"
                  onClick={() => qGalleryRef.current?.click()}
                >
                  Dosya Seç
                </button>
                <div className="flex md:hidden w-full flex-col sm:flex-row gap-2 px-4">
                  <button
                    type="button"
                    className="flex-1 py-2 rounded-lg border border-border bg-background text-sm"
                    onClick={() => qCameraRef.current?.click()}
                  >
                    Fotoğraf Çek
                  </button>
                  <button
                    type="button"
                    className="flex-1 py-2 rounded-lg border border-border bg-background text-sm"
                    onClick={() => qGalleryRef.current?.click()}
                  >
                    Galeriden Seç
                  </button>
                </div>
              </div>
            )}
            <input
              ref={qCameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) void handleImageUpload(f, setQuestionImg);
                e.target.value = '';
              }}
            />
            <input
              ref={qGalleryRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) void handleImageUpload(f, setQuestionImg);
                e.target.value = '';
              }}
            />
          </div>

          {/* Subject */}
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Ders / Konu (opsiyonel)</label>
            <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Örn: Matematik, Fizik..." className="w-full px-3 py-2 rounded-lg border border-border bg-input-background" />
          </div>

          {/* Difficulty */}
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Zorluk *</label>
            <div className="flex flex-wrap gap-2">
              {(['hard', 'medium', 'easy', 'custom'] as const).map(d => (
                <button key={d} onClick={() => setDifficulty(d)} className={`flex-1 min-w-[calc(50%-0.25rem)] py-2 rounded-lg border text-sm transition-colors ${difficulty === d ? difficultyColor[d] : 'border-border hover:bg-accent'}`}>
                  {difficultyLabel[d]}
                </button>
              ))}
            </div>
            {difficulty === 'custom' && (
              <div className="mt-3">
                <label className="flex flex-col gap-1 text-sm max-w-xs">
                  <span className="text-muted-foreground">Gün</span>
                  <input
                    type="number"
                    min={0}
                    max={365}
                    value={customDays}
                    onChange={e => setCustomDays(Number(e.target.value))}
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </label>
              </div>
            )}
          </div>

          {/* Answer type */}
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Cevap Türü</label>
            <div className="flex gap-2">
              <button onClick={() => setAnswerType('text')} className={`flex-1 py-2 rounded-lg border text-sm ${answerType === 'text' ? 'bg-primary text-primary-foreground' : 'border-border'}`}>Metin</button>
              <button onClick={() => setAnswerType('image')} className={`flex-1 py-2 rounded-lg border text-sm ${answerType === 'image' ? 'bg-primary text-primary-foreground' : 'border-border'}`}>Fotoğraf</button>
            </div>
          </div>

          {/* Answer */}
          {answerType === 'text' ? (
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Cevap *</label>
              <textarea value={answerText} onChange={e => setAnswerText(e.target.value)} rows={3} placeholder="Cevabı buraya yazın..." className="w-full px-3 py-2 rounded-lg border border-border bg-input-background resize-none" />
            </div>
          ) : (
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Cevap Fotoğrafı *</label>
              {answerImg ? (
                <div className="relative">
                  <img src={answerImg} alt="Cevap" className="w-full max-h-64 object-contain rounded-lg border border-border" />
                  <button onClick={() => setAnswerImg('')} className="absolute top-2 right-2 p-1 rounded-full bg-black/50 text-white"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <div className="w-full py-8 border-2 border-dashed border-border rounded-lg flex flex-col items-center gap-3 hover:bg-accent transition-colors">
                  <Camera className="w-8 h-8 text-muted-foreground md:hidden" />
                  <button
                    type="button"
                    className="hidden md:inline-flex px-4 py-2 rounded-lg border border-border bg-background text-sm"
                    onClick={() => aGalleryRef.current?.click()}
                  >
                    Dosya Seç
                  </button>
                  <div className="flex md:hidden w-full flex-col sm:flex-row gap-2 px-4">
                    <button
                      type="button"
                      className="flex-1 py-2 rounded-lg border border-border bg-background text-sm"
                      onClick={() => aCameraRef.current?.click()}
                    >
                      Fotoğraf Çek
                    </button>
                    <button
                      type="button"
                      className="flex-1 py-2 rounded-lg border border-border bg-background text-sm"
                      onClick={() => aGalleryRef.current?.click()}
                    >
                      Galeriden Seç
                    </button>
                  </div>
                </div>
              )}
              <input
                ref={aCameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) void handleImageUpload(f, setAnswerImg);
                  e.target.value = '';
                }}
              />
              <input
                ref={aGalleryRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) void handleImageUpload(f, setAnswerImg);
                  e.target.value = '';
                }}
              />
            </div>
          )}

          <button onClick={handleSubmit} className="w-full py-3 rounded-lg bg-primary text-primary-foreground">Soruyu Kaydet</button>
        </div>
      )}

      {/* Question list */}
      {questions.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FileQuestionIcon />
          <p className="mt-3">Henüz soru eklemediniz</p>
          <p className="text-sm">Çözemediğiniz soruları ekleyerek tekrar programı oluşturun</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {questions.map(q => (
            <div key={q.id} className="bg-card rounded-xl border border-border overflow-hidden relative">
              <div className="relative">
                <img src={q.imageUrl} alt="Soru" className="w-full h-40 object-cover" />
                <div className="absolute top-2 right-2 flex gap-1">
                  <button
                    type="button"
                    onClick={() => openReviewDialog(q.id)}
                    className="p-1 rounded-full bg-black/50 text-white hover:bg-black/70"
                    aria-label="Tekrar zamanını ayarla"
                  >
                    <Calendar className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIdToDelete(q.id)}
                    className="p-1 rounded-full bg-black/50 text-white hover:bg-black/70"
                    aria-label="Soruyu sil"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="p-3">
                <div className="flex items-center justify-between">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${difficultyColor[q.difficulty as keyof typeof difficultyColor] ?? difficultyColor.medium}`}>
                    {q.difficulty === 'hard' ? 'Zor' : q.difficulty === 'medium' ? 'Orta' : q.difficulty === 'custom' ? 'Özel' : 'Kolay'}
                  </span>
                  {q.subject && <span className="text-xs text-muted-foreground">{q.subject}</span>}
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  Tekrar: {new Date(q.nextReviewAt).toLocaleDateString('tr-TR')} · {q.reviewCount} tekrar
                </div>
              </div>
              {(q.lastResult === 'solved' || q.lastResult === 'failed') && (
                <div className="px-3 pb-3 text-xs text-muted-foreground border-t border-border pt-2">
                  {q.lastResult === 'solved' ? 'Son tekrar: Çözdüm ✓' : 'Son tekrar: Çözemedim ✗'}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={reviewDialogOpen}
        onOpenChange={(open) => {
          setReviewDialogOpen(open);
          if (!open) setReviewTargetId(null);
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
                value={reviewDays}
                onChange={e => setReviewDays(Number(e.target.value))}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setReviewDialogOpen(false)}>
              İptal
            </Button>
            <Button type="button" onClick={() => void handleSaveReviewDate()}>
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={idToDelete !== null} onOpenChange={(open) => { if (!open) setIdToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bu soruyu silmek istediğine emin misin?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">İptal</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              onClick={() => idToDelete && void handleDeleteQuestion(idToDelete)}
            >
              Sil
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FileQuestionIcon() {
  return (
    <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
      <Camera className="w-8 h-8 text-muted-foreground" />
    </div>
  );
}
