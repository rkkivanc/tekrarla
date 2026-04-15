import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Calendar, Camera, ChevronDown, ChevronRight, FolderOpen, Pencil, Plus, X } from 'lucide-react';
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

function capitalizeSubjectLabel(keyLower: string): string {
  if (!keyLower) return '';
  return keyLower.charAt(0).toUpperCase() + keyLower.slice(1);
}

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
  const [existingSubjects, setExistingSubjects] = useState<string[]>([]);
  const [subjectDropdownOpen, setSubjectDropdownOpen] = useState(false);
  const [openFolders, setOpenFolders] = useState<Set<string>>(() => new Set());
  const subjectComboRef = useRef<HTMLDivElement>(null);
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
  const [editingQuestion, setEditingQuestion] = useState<QuestionWithMeta | null>(null);
  const [editImg, setEditImg] = useState('');
  const [editAnswerImg, setEditAnswerImg] = useState('');
  const [editAnswerText, setEditAnswerText] = useState('');
  const [editDifficulty, setEditDifficulty] = useState<'easy' | 'medium' | 'hard' | 'custom'>('medium');
  const [editSubject, setEditSubject] = useState('');
  const [editAnswerType, setEditAnswerType] = useState<'text' | 'image'>('text');
  const [editSubjectDropdownOpen, setEditSubjectDropdownOpen] = useState(false);
  const editSubjectComboRef = useRef<HTMLDivElement>(null);
  const editQCameraRef = useRef<HTMLInputElement>(null);
  const editQGalleryRef = useRef<HTMLInputElement>(null);
  const editACameraRef = useRef<HTMLInputElement>(null);
  const editAGalleryRef = useRef<HTMLInputElement>(null);
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);

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
        const { data } = await api.get<string[]>('/subjects');
        if (!cancelled && Array.isArray(data)) setExistingSubjects(data);
      } catch {
        if (!cancelled) setExistingSubjects([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!subjectDropdownOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (subjectComboRef.current && !subjectComboRef.current.contains(e.target as Node)) {
        setSubjectDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [subjectDropdownOpen]);

  useEffect(() => {
    if (!editSubjectDropdownOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (editSubjectComboRef.current && !editSubjectComboRef.current.contains(e.target as Node)) {
        setEditSubjectDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [editSubjectDropdownOpen]);

  useEffect(() => {
    if (!editingQuestion) return;
    setEditImg(editingQuestion.imageUrl);
    setEditAnswerImg(editingQuestion.answerImageUrl ?? '');
    setEditAnswerText(editingQuestion.answerText ?? '');
    const d = editingQuestion.difficulty as string;
    setEditDifficulty(
      d === 'easy' || d === 'medium' || d === 'hard' || d === 'custom'
        ? (d as 'easy' | 'medium' | 'hard' | 'custom')
        : 'medium',
    );
    setEditSubject(editingQuestion.subject ?? '');
    const hasText = Boolean(editingQuestion.answerText?.trim());
    const hasImg = Boolean(editingQuestion.answerImageUrl);
    setEditAnswerType(hasImg && !hasText ? 'image' : 'text');
    setEditSubjectDropdownOpen(false);
  }, [editingQuestion]);

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

  const handleSaveQuestionContent = async () => {
    if (!editingQuestion) return;
    if (!editImg.trim()) {
      toast.error('Lütfen soru fotoğrafı yükleyin');
      return;
    }
    if (editAnswerType === 'text' && !editAnswerText.trim()) {
      toast.error('Lütfen cevap yazın');
      return;
    }
    if (editAnswerType === 'image' && !editAnswerImg) {
      toast.error('Lütfen cevap fotoğrafı yükleyin');
      return;
    }
    try {
      const { data } = await api.patch<QuestionApiRow>(`/questions/${editingQuestion.id}/content`, {
        image_url: editImg.trim(),
        subject: editSubject.trim() ? editSubject.trim().toLowerCase() : null,
        difficulty: editDifficulty,
        answer_text: editAnswerType === 'text' ? editAnswerText : null,
        answer_image_url: editAnswerType === 'image' ? editAnswerImg : null,
      });
      const updated = mapRowToQuestion(data);
      setQuestions(prev => prev.map(q => (q.id === updated.id ? updated : q)));
      setEditingQuestion(null);
      toast.success('Soru güncellendi');
    } catch (e) {
      console.error(e);
      const msg = isAxiosError(e) ? (e.response?.data as { error?: string })?.error : undefined;
      toast.error(msg ?? 'Soru güncellenemedi');
    }
  };

  const filteredSubjects = useMemo(() => {
    const q = subject.trim().toLowerCase();
    if (!q) return existingSubjects;
    return existingSubjects.filter(s => s.toLowerCase().includes(q));
  }, [existingSubjects, subject]);

  const filteredEditSubjects = useMemo(() => {
    const q = editSubject.trim().toLowerCase();
    if (!q) return existingSubjects;
    return existingSubjects.filter(s => s.toLowerCase().includes(q));
  }, [existingSubjects, editSubject]);

  const { subjectGroups, subjectlessQuestions } = useMemo(() => {
    const subjectless: QuestionWithMeta[] = [];
    const map = new Map<string, QuestionWithMeta[]>();
    for (const q of questions) {
      const raw = q.subject?.trim();
      if (!raw) {
        subjectless.push(q);
        continue;
      }
      const key = raw.toLowerCase();
      const arr = map.get(key);
      if (arr) arr.push(q);
      else map.set(key, [q]);
    }
    const subjectGroups = [...map.entries()]
      .map(([key, items]) => ({
        key,
        label: capitalizeSubjectLabel(key),
        items,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'tr'));
    return { subjectGroups, subjectlessQuestions: subjectless };
  }, [questions]);

  const toggleFolder = (key: string) => {
    setOpenFolders(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
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
      {zoomUrl && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setZoomUrl(null)}
          role="presentation"
        >
          <img
            src={zoomUrl}
            alt=""
            className="max-h-full max-w-full object-contain"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
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

          {/* Subject combobox */}
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Ders / Konu (opsiyonel)</label>
            <div className="relative" ref={subjectComboRef}>
              <input
                value={subject}
                onChange={e => {
                  setSubject(e.target.value);
                  setSubjectDropdownOpen(true);
                }}
                onFocus={() => setSubjectDropdownOpen(true)}
                onBlur={() => setSubject(s => s.trim())}
                placeholder="Örn: Matematik, Fizik..."
                autoComplete="off"
                className="w-full px-3 py-2 rounded-lg border border-border bg-input-background"
              />
              {subjectDropdownOpen && filteredSubjects.length > 0 && (
                <ul
                  className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-border bg-input-background shadow-md"
                  role="listbox"
                >
                  {filteredSubjects.map(s => (
                    <li
                      key={s}
                      role="option"
                      className="cursor-pointer px-3 py-2 text-sm hover:bg-accent"
                      onMouseDown={e => {
                        e.preventDefault();
                        setSubject(s);
                        setSubjectDropdownOpen(false);
                      }}
                    >
                      {s}
                    </li>
                  ))}
                </ul>
              )}
            </div>
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
        <div className="space-y-2">
          {subjectGroups.map(({ key, label, items }) => {
            const open = openFolders.has(key);
            return (
              <div key={key}>
                <button
                  type="button"
                  onClick={() => toggleFolder(key)}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-accent"
                >
                  {open ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  )}
                  <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1 font-medium">{label}</span>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {items.length}
                  </span>
                </button>
                {open && (
                  <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {items.map(q => (
                      <QuestionListCard
                        key={q.id}
                        q={q}
                        difficultyColor={difficultyColor}
                        openReviewDialog={openReviewDialog}
                        onRequestDelete={setIdToDelete}
                        onOpenEdit={setEditingQuestion}
                        onImageZoom={setZoomUrl}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {subjectlessQuestions.length > 0 && (
            <div
              className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${subjectGroups.length > 0 ? 'mt-4' : ''}`}
            >
              {subjectlessQuestions.map(q => (
                <QuestionListCard
                  key={q.id}
                  q={q}
                  difficultyColor={difficultyColor}
                  openReviewDialog={openReviewDialog}
                  onRequestDelete={setIdToDelete}
                  onOpenEdit={setEditingQuestion}
                  onImageZoom={setZoomUrl}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <Dialog
        open={editingQuestion !== null}
        onOpenChange={(open) => {
          if (!open) setEditingQuestion(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Soruyu düzenle</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Soru Fotoğrafı *</label>
              {editImg ? (
                <div className="relative">
                  <img
                    src={editImg}
                    alt="Soru"
                    className="w-full max-h-64 cursor-zoom-in object-contain rounded-lg border border-border"
                    onClick={() => setZoomUrl(editImg)}
                  />
                  <button
                    type="button"
                    onClick={() => setEditImg('')}
                    className="absolute top-2 right-2 p-1 rounded-full bg-black/50 text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="w-full py-8 border-2 border-dashed border-border rounded-lg flex flex-col items-center gap-3 hover:bg-accent transition-colors">
                  <Camera className="w-8 h-8 text-muted-foreground md:hidden" />
                  <button
                    type="button"
                    className="hidden md:inline-flex px-4 py-2 rounded-lg border border-border bg-background text-sm"
                    onClick={() => editQGalleryRef.current?.click()}
                  >
                    Dosya Seç
                  </button>
                  <div className="flex md:hidden w-full flex-col sm:flex-row gap-2 px-4">
                    <button
                      type="button"
                      className="flex-1 py-2 rounded-lg border border-border bg-background text-sm"
                      onClick={() => editQCameraRef.current?.click()}
                    >
                      Fotoğraf Çek
                    </button>
                    <button
                      type="button"
                      className="flex-1 py-2 rounded-lg border border-border bg-background text-sm"
                      onClick={() => editQGalleryRef.current?.click()}
                    >
                      Galeriden Seç
                    </button>
                  </div>
                </div>
              )}
              <input
                ref={editQCameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) void handleImageUpload(f, setEditImg);
                  e.target.value = '';
                }}
              />
              <input
                ref={editQGalleryRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) void handleImageUpload(f, setEditImg);
                  e.target.value = '';
                }}
              />
            </div>

            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Ders / Konu (opsiyonel)</label>
              <div className="relative" ref={editSubjectComboRef}>
                <input
                  value={editSubject}
                  onChange={e => {
                    setEditSubject(e.target.value);
                    setEditSubjectDropdownOpen(true);
                  }}
                  onFocus={() => setEditSubjectDropdownOpen(true)}
                  onBlur={() => setEditSubject(s => s.trim())}
                  placeholder="Örn: Matematik, Fizik..."
                  autoComplete="off"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-input-background"
                />
                {editSubjectDropdownOpen && filteredEditSubjects.length > 0 && (
                  <ul
                    className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-border bg-input-background shadow-md"
                    role="listbox"
                  >
                    {filteredEditSubjects.map(s => (
                      <li
                        key={s}
                        role="option"
                        className="cursor-pointer px-3 py-2 text-sm hover:bg-accent"
                        onMouseDown={e => {
                          e.preventDefault();
                          setEditSubject(s);
                          setEditSubjectDropdownOpen(false);
                        }}
                      >
                        {s}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Zorluk *</label>
              <div className="flex flex-wrap gap-2">
                {(['hard', 'medium', 'easy', 'custom'] as const).map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setEditDifficulty(d)}
                    className={`flex-1 min-w-[calc(50%-0.25rem)] py-2 rounded-lg border text-sm transition-colors ${editDifficulty === d ? difficultyColor[d] : 'border-border hover:bg-accent'}`}
                  >
                    {difficultyLabel[d]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Cevap Türü</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditAnswerType('text')}
                  className={`flex-1 py-2 rounded-lg border text-sm ${editAnswerType === 'text' ? 'bg-primary text-primary-foreground' : 'border-border'}`}
                >
                  Metin
                </button>
                <button
                  type="button"
                  onClick={() => setEditAnswerType('image')}
                  className={`flex-1 py-2 rounded-lg border text-sm ${editAnswerType === 'image' ? 'bg-primary text-primary-foreground' : 'border-border'}`}
                >
                  Fotoğraf
                </button>
              </div>
            </div>

            {editAnswerType === 'text' ? (
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Cevap *</label>
                <textarea
                  value={editAnswerText}
                  onChange={e => setEditAnswerText(e.target.value)}
                  rows={3}
                  placeholder="Cevabı buraya yazın..."
                  className="w-full px-3 py-2 rounded-lg border border-border bg-input-background resize-none"
                />
              </div>
            ) : (
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Cevap Fotoğrafı *</label>
                {editAnswerImg ? (
                  <div className="relative">
                    <img
                      src={editAnswerImg}
                      alt="Cevap"
                      className="w-full max-h-64 cursor-zoom-in object-contain rounded-lg border border-border"
                      onClick={() => setZoomUrl(editAnswerImg)}
                    />
                    <button
                      type="button"
                      onClick={() => setEditAnswerImg('')}
                      className="absolute top-2 right-2 p-1 rounded-full bg-black/50 text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="w-full py-8 border-2 border-dashed border-border rounded-lg flex flex-col items-center gap-3 hover:bg-accent transition-colors">
                    <Camera className="w-8 h-8 text-muted-foreground md:hidden" />
                    <button
                      type="button"
                      className="hidden md:inline-flex px-4 py-2 rounded-lg border border-border bg-background text-sm"
                      onClick={() => editAGalleryRef.current?.click()}
                    >
                      Dosya Seç
                    </button>
                    <div className="flex md:hidden w-full flex-col sm:flex-row gap-2 px-4">
                      <button
                        type="button"
                        className="flex-1 py-2 rounded-lg border border-border bg-background text-sm"
                        onClick={() => editACameraRef.current?.click()}
                      >
                        Fotoğraf Çek
                      </button>
                      <button
                        type="button"
                        className="flex-1 py-2 rounded-lg border border-border bg-background text-sm"
                        onClick={() => editAGalleryRef.current?.click()}
                      >
                        Galeriden Seç
                      </button>
                    </div>
                  </div>
                )}
                <input
                  ref={editACameraRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) void handleImageUpload(f, setEditAnswerImg);
                    e.target.value = '';
                  }}
                />
                <input
                  ref={editAGalleryRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) void handleImageUpload(f, setEditAnswerImg);
                    e.target.value = '';
                  }}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditingQuestion(null)}>
              İptal
            </Button>
            <Button type="button" onClick={() => void handleSaveQuestionContent()}>
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

function QuestionListCard({
  q,
  difficultyColor,
  openReviewDialog,
  onRequestDelete,
  onOpenEdit,
  onImageZoom,
}: {
  q: QuestionWithMeta;
  difficultyColor: Record<'easy' | 'medium' | 'hard' | 'custom', string>;
  openReviewDialog: (id: string) => void;
  onRequestDelete: (id: string) => void;
  onOpenEdit: (question: QuestionWithMeta) => void;
  onImageZoom: (url: string) => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card">
      <div className="relative">
        <img
          src={q.imageUrl}
          alt="Soru"
          className="h-40 w-full cursor-zoom-in object-cover"
          onClick={() => onImageZoom(q.imageUrl)}
        />
        <div className="absolute right-2 top-2 flex gap-1">
          <button
            type="button"
            onClick={() => openReviewDialog(q.id)}
            className="rounded-full bg-black/50 p-1 text-white hover:bg-black/70"
            aria-label="Tekrar zamanını ayarla"
          >
            <Calendar className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onOpenEdit(q)}
            className="rounded-full bg-black/50 p-1 text-white hover:bg-black/70"
            aria-label="Soruyu düzenle"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onRequestDelete(q.id)}
            className="rounded-full bg-black/50 p-1 text-white hover:bg-black/70"
            aria-label="Soruyu sil"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="p-3">
        <div className="flex items-center justify-between">
          <span
            className={`rounded-full px-2 py-0.5 text-xs ${difficultyColor[q.difficulty as keyof typeof difficultyColor] ?? difficultyColor.medium}`}
          >
            {q.difficulty === 'hard'
              ? 'Zor'
              : q.difficulty === 'medium'
                ? 'Orta'
                : q.difficulty === 'custom'
                  ? 'Özel'
                  : 'Kolay'}
          </span>
          {q.subject && <span className="text-xs text-muted-foreground">{q.subject}</span>}
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          Tekrar: {new Date(q.nextReviewAt).toLocaleDateString('tr-TR')} · {q.reviewCount} tekrar
        </div>
      </div>
      {(q.lastResult === 'solved' || q.lastResult === 'failed') && (
        <div className="border-t border-border px-3 pb-3 pt-2 text-xs text-muted-foreground">
          {q.lastResult === 'solved' ? 'Son tekrar: Çözdüm ✓' : 'Son tekrar: Çözemedim ✗'}
        </div>
      )}
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
