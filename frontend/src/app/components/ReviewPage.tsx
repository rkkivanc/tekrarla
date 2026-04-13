import React from 'react';
import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import { Check, X, Eye, Trash2, BookOpen, FileQuestion } from 'lucide-react';
import {
  isDueForReview,
  getNextReviewDate,
  type DifficultyIntervalSettings,
  type Question,
  type Topic,
} from '../store';
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';

type ReviewItem = { type: 'question'; data: Question } | { type: 'topic'; data: Topic };

const NO_SUBJECT_KEY = '__none__';
const NO_SUBJECT_LABEL = 'Ders belirtilmemiş';

function subjectKeyFromItem(item: ReviewItem): string {
  const s = item.data.subject;
  const t = typeof s === 'string' ? s.trim() : '';
  return t ? t.toLowerCase() : NO_SUBJECT_KEY;
}

function capitalizeLabel(key: string): string {
  if (key === NO_SUBJECT_KEY) return NO_SUBJECT_LABEL;
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function filterItemsBySubject(items: ReviewItem[], subjectFilter: string[] | null): ReviewItem[] {
  if (subjectFilter === null) return items;
  return items.filter(it => subjectFilter.includes(subjectKeyFromItem(it)));
}

function uniqueSubjectKeysFromDue(due: ReviewItem[]): string[] {
  const set = new Set<string>();
  for (const it of due) set.add(subjectKeyFromItem(it));
  return [...set];
}

function buildSubjectChipsFromDue(due: ReviewItem[]): { key: string; label: string; count: number }[] {
  const map = new Map<string, number>();
  for (const it of due) {
    const k = subjectKeyFromItem(it);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([key, count]) => ({ key, label: capitalizeLabel(key), count }))
    .sort((a, b) => a.label.localeCompare(b.label, 'tr'));
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
};

type TopicApiRow = {
  id: string;
  title: string;
  notes: string | null;
  image_url: string | null;
  subject?: string | null;
  created_at: string;
  next_review_at: string | null;
  review_count: number;
  last_result?: string | null;
};

function mapQuestionRow(row: QuestionApiRow): Question {
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
  };
}

function mapTopicRow(row: TopicApiRow): Topic {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes ?? '',
    imageUrl: row.image_url ?? undefined,
    subject: row.subject ?? undefined,
    createdAt: row.created_at,
    nextReviewAt: row.next_review_at ?? new Date().toISOString(),
    reviewCount: row.review_count,
  };
}

export function ReviewPage() {
  const [rawDueItems, setRawDueItems] = useState<ReviewItem[]>([]);
  const [rawUpcomingItems, setRawUpcomingItems] = useState<ReviewItem[]>([]);
  const [sessionDuePool, setSessionDuePool] = useState<ReviewItem[]>([]);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [subjectFilter, setSubjectFilter] = useState<string[] | null>(null);
  const [filterApplied, setFilterApplied] = useState(false);
  const [reviewKindTab, setReviewKindTab] = useState<'question' | 'topic'>('question');
  const [tumuActive, setTumuActive] = useState(true);
  const [selectedSubjectKeys, setSelectedSubjectKeys] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editReviewDialogOpen, setEditReviewDialogOpen] = useState(false);
  const [editReviewDays, setEditReviewDays] = useState(1);
  const [difficultyIntervals, setDifficultyIntervals] = useState<DifficultyIntervalSettings>({
    hard: 1,
    medium: 3,
    easy: 5,
  });
  const reviewSectionRef = useRef<HTMLDivElement>(null);
  const pendingScrollToReviewRef = useRef(false);

  useLayoutEffect(() => {
    if (!pendingScrollToReviewRef.current || items.length === 0) return;
    pendingScrollToReviewRef.current = false;
    reviewSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [items.length]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const settingsRes = await api.get<DifficultyIntervalSettings>('/settings/difficulty');
        if (
          !cancelled &&
          settingsRes.data &&
          typeof settingsRes.data.hard === 'number' &&
          typeof settingsRes.data.medium === 'number' &&
          typeof settingsRes.data.easy === 'number'
        ) {
          setDifficultyIntervals(settingsRes.data);
        }
      } catch {
        /* varsayılan aralıklar */
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
        const [qRes, tRes] = await Promise.all([
          api.get<QuestionApiRow[]>('/questions'),
          api.get<TopicApiRow[]>('/topics'),
        ]);
        if (cancelled) return;
        const dueQ = qRes.data
          .filter(row => !row.deleted && row.next_review_at != null && isDueForReview(row.next_review_at))
          .map(row => ({ type: 'question' as const, data: mapQuestionRow(row) }));
        const dueT = tRes.data
          .filter(row => row.next_review_at != null && isDueForReview(row.next_review_at))
          .map(row => ({ type: 'topic' as const, data: mapTopicRow(row) }));
        const upcomingQ = qRes.data
          .filter(row => !row.deleted && row.next_review_at != null && !isDueForReview(row.next_review_at))
          .map(row => ({ type: 'question' as const, data: mapQuestionRow(row) }));
        const upcomingT = tRes.data
          .filter(row => row.next_review_at != null && !isDueForReview(row.next_review_at))
          .map(row => ({ type: 'topic' as const, data: mapTopicRow(row) }));
        const dueAll = [...dueQ, ...dueT];
        const upcomingAll = [...upcomingQ, ...upcomingT];
        setRawDueItems(dueAll);
        setRawUpcomingItems(upcomingAll);
        const needSubjectFilter = dueAll.length > 0 && uniqueSubjectKeysFromDue(dueAll).length >= 2;
        if (dueAll.length === 0) {
          setFilterApplied(false);
          setSubjectFilter(null);
          setSessionDuePool([]);
          setItems([]);
        } else if (!needSubjectFilter) {
          setFilterApplied(true);
          setSubjectFilter(null);
          setSessionDuePool(dueAll);
          const initialTab = dueAll.some(i => i.type === 'question') ? 'question' : 'topic';
          setReviewKindTab(initialTab);
          setItems(dueAll.filter(i => i.type === initialTab));
        } else {
          setFilterApplied(false);
          setSubjectFilter(null);
          setSessionDuePool([]);
          setItems([]);
          setTumuActive(true);
          setSelectedSubjectKeys(new Set());
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) toast.error('Tekrar listesi yüklenemedi');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const previewSubjectFilter = useMemo((): string[] | null => {
    if (filterApplied) return subjectFilter;
    if (tumuActive) return null;
    if (selectedSubjectKeys.size === 0) return null;
    return [...selectedSubjectKeys];
  }, [filterApplied, subjectFilter, tumuActive, selectedSubjectKeys]);

  const previewDueFiltered = useMemo(
    () => filterItemsBySubject(rawDueItems, previewSubjectFilter),
    [rawDueItems, previewSubjectFilter],
  );

  const previewQuestionCount = useMemo(
    () => previewDueFiltered.filter(i => i.type === 'question').length,
    [previewDueFiltered],
  );
  const previewTopicCount = useMemo(
    () => previewDueFiltered.filter(i => i.type === 'topic').length,
    [previewDueFiltered],
  );

  const upcomingDisplayed = useMemo(
    () => filterItemsBySubject(rawUpcomingItems, previewSubjectFilter),
    [rawUpcomingItems, previewSubjectFilter],
  );

  const subjectChipList = useMemo(() => buildSubjectChipsFromDue(rawDueItems), [rawDueItems]);

  const needsSubjectFilterStep =
    rawDueItems.length > 0 && uniqueSubjectKeysFromDue(rawDueItems).length >= 2 && !filterApplied;

  const sessionQuestionCount = useMemo(
    () => sessionDuePool.filter(i => i.type === 'question').length,
    [sessionDuePool],
  );
  const sessionTopicCount = useMemo(
    () => sessionDuePool.filter(i => i.type === 'topic').length,
    [sessionDuePool],
  );

  const handleReviewTabChange = useCallback(
    (tab: 'question' | 'topic') => {
      setReviewKindTab(tab);
      setCurrentIndex(0);
      setShowAnswer(false);
      setFlipped(false);
      if (filterApplied) {
        setItems(sessionDuePool.filter(i => i.type === tab));
      }
    },
    [filterApplied, sessionDuePool],
  );

  const handleCommitFilterStart = useCallback(() => {
    const committed: string[] | null = tumuActive ? null : [...selectedSubjectKeys];
    if (!tumuActive && (!committed || committed.length === 0)) {
      toast.error('En az bir ders seç veya Tümü\'yü kullan');
      return;
    }
    const pool = filterItemsBySubject(rawDueItems, committed);
    if (pool.length === 0) {
      toast.error('Seçime uygun tekrar yok');
      return;
    }
    const nextTab = pool.some(i => i.type === reviewKindTab)
      ? reviewKindTab
      : pool.some(i => i.type === 'question')
        ? 'question'
        : 'topic';
    setSubjectFilter(committed);
    setFilterApplied(true);
    setSessionDuePool(pool);
    setReviewKindTab(nextTab);
    setItems(pool.filter(i => i.type === nextTab));
    setCurrentIndex(0);
    setShowAnswer(false);
    setFlipped(false);
  }, [rawDueItems, tumuActive, selectedSubjectKeys, reviewKindTab]);

  const current = items[currentIndex];

  const openEditReviewDialog = () => {
    setEditReviewDays(1);
    setEditReviewDialogOpen(true);
  };

  const handleSaveEditReviewDate = async () => {
    if (!current) return;
    const d0 = Number.isFinite(editReviewDays) ? Math.floor(editReviewDays) : 1;
    const days = Math.min(365, Math.max(0, d0));
    try {
      if (current.type === 'question') {
        const { data } = await api.patch<QuestionApiRow>(`/questions/${current.data.id}/review-date`, {
          days,
          hours: 0,
          minutes: 0,
        });
        const updated = mapQuestionRow(data);
        setItems(prev => prev.map((it, i) => (i === currentIndex ? { type: 'question' as const, data: updated } : it)));
        setSessionDuePool(prev =>
          prev.map(it =>
            it.type === 'question' && it.data.id === updated.id ? { type: 'question' as const, data: updated } : it,
          ),
        );
      } else {
        const { data } = await api.patch<TopicApiRow>(`/topics/${current.data.id}/review-date`, {
          days,
          hours: 0,
          minutes: 0,
        });
        const updated = mapTopicRow(data);
        setItems(prev => prev.map((it, i) => (i === currentIndex ? { type: 'topic' as const, data: updated } : it)));
        setSessionDuePool(prev =>
          prev.map(it =>
            it.type === 'topic' && it.data.id === updated.id ? { type: 'topic' as const, data: updated } : it,
          ),
        );
      }
      setEditReviewDialogOpen(false);
      toast.success('Tekrar zamanı güncellendi');
    } catch (e) {
      console.error(e);
      const msg = isAxiosError(e) ? (e.response?.data as { error?: string })?.error : undefined;
      toast.error(msg ?? 'Tekrar zamanı güncellenemedi');
    }
  };

  const handleSolved = async (solved: boolean) => {
    if (!current || current.type !== 'question') return;
    const q = current.data;
    const nextAt = solved
      ? getNextReviewDate(q.difficulty, difficultyIntervals)
      : new Date(Date.now() + 86400000).toISOString();
    try {
      await api.patch(`/questions/${q.id}`, {
        solved,
        review_count: q.reviewCount + 1,
        next_review_at: nextAt,
        last_result: solved ? 'solved' : 'failed',
      });
      toast.success(solved ? 'Harika! Başardın! 🎉' : 'Tekrar zamanı ayarlandı');
      next();
    } catch (e) {
      console.error(e);
      toast.error('Güncelleme başarısız');
    }
  };

  const handleTopicReview = async (lastResult: 'understood' | 'not_understood') => {
    if (!current || current.type !== 'topic') return;
    const t = current.data;
    const nextReviewAt =
      lastResult === 'understood'
        ? new Date(Date.now() + 3 * 86400000).toISOString()
        : new Date(Date.now() + 86400000).toISOString();
    try {
      await api.patch(`/topics/${t.id}`, {
        review_count: t.reviewCount + 1,
        next_review_at: nextReviewAt,
        last_result: lastResult,
      });
      toast.success(lastResult === 'understood' ? 'Harika! Başardın! 🎉' : 'Tekrar zamanı ayarlandı');
      next();
    } catch (e) {
      console.error(e);
      toast.error('Güncelleme başarısız');
    }
  };

  const handleStartEarlyRepeat = (item: ReviewItem) => {
    pendingScrollToReviewRef.current = true;
    setRawUpcomingItems(prev => prev.filter(x => !(x.type === item.type && x.data.id === item.data.id)));
    setSessionDuePool(prev => {
      if (prev.some(x => x.type === item.type && x.data.id === item.data.id)) return prev;
      return [item, ...prev];
    });
    if (item.type === reviewKindTab) {
      setItems(prev => {
        if (prev.some(x => x.type === item.type && x.data.id === item.data.id)) return prev;
        return [item, ...prev];
      });
    }
    setCurrentIndex(0);
    setShowAnswer(false);
    setFlipped(false);
  };

  const handleDelete = async () => {
    if (!current || current.type !== 'question') return;
    try {
      await api.delete(`/questions/${current.data.id}`);
      toast.success('Soru silindi');
      setDeleteDialogOpen(false);
      setSessionDuePool(prev => prev.filter(x => !(x.type === 'question' && x.data.id === current.data.id)));
      const newItems = items.filter((_, i) => i !== currentIndex);
      setItems(newItems);
      if (currentIndex >= newItems.length) setCurrentIndex(Math.max(0, newItems.length - 1));
      setShowAnswer(false);
      setFlipped(false);
    } catch (e) {
      console.error(e);
      toast.error('Soru silinemedi');
    }
  };

  const next = () => {
    setShowAnswer(false);
    setFlipped(false);
    const cur = items[currentIndex];
    if (cur) {
      setSessionDuePool(prev =>
        prev.filter(x => !(x.type === cur.type && x.data.id === cur.data.id)),
      );
    }
    const newItems = items.filter((_, i) => i !== currentIndex);
    setItems(newItems);
    if (currentIndex >= newItems.length) setCurrentIndex(Math.max(0, newItems.length - 1));
  };

  const showCongrats =
    !loading &&
    !needsSubjectFilterStep &&
    (rawDueItems.length === 0 || (filterApplied && sessionDuePool.length === 0));

  const showReviewShell = !loading && !needsSubjectFilterStep && !showCongrats && filterApplied;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center pb-20 md:pb-0">
        <p className="text-muted-foreground">Yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bu soruyu silmek istediğine emin misin?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">İptal</AlertDialogCancel>
            <Button type="button" variant="destructive" onClick={() => void handleDelete()}>
              Sil
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={editReviewDialogOpen}
        onOpenChange={open => {
          setEditReviewDialogOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tekrar Zamanını Düzenle</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="edit-review-days">Gün (şu andan itibaren)</Label>
              <Input
                id="edit-review-days"
                type="number"
                min={0}
                max={365}
                value={editReviewDays}
                onChange={e => setEditReviewDays(Number(e.target.value))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditReviewDialogOpen(false)}>
              İptal
            </Button>
            <Button type="button" onClick={() => void handleSaveEditReviewDate()}>
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showCongrats && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-50">
            <Check className="h-10 w-10 text-green-600" />
          </div>
          <h2>Tebrikler! 🎉</h2>
          <p className="mt-2 text-muted-foreground">Şu an tekrar edilecek bir şey yok.</p>
          <p className="mt-1 text-sm text-muted-foreground">Yeni sorular ve konular ekleyerek tekrar planını oluştur.</p>
        </div>
      )}

      {needsSubjectFilterStep && (
        <div className="mx-auto flex w-full max-w-md flex-col gap-6">
          <h2 className="text-center text-lg font-semibold">Hangi dersi tekrar etmek istiyorsun?</h2>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                setTumuActive(true);
                setSelectedSubjectKeys(new Set());
              }}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors ${
                tumuActive ? 'border-transparent bg-primary text-primary-foreground' : 'border-border bg-background hover:bg-accent'
              }`}
            >
              Tümü
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  tumuActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}
              >
                {rawDueItems.length}
              </span>
            </button>
            {subjectChipList.map(({ key, label, count }) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setTumuActive(false);
                  setSelectedSubjectKeys(prev => {
                    const n = new Set(prev);
                    if (n.has(key)) n.delete(key);
                    else n.add(key);
                    return n;
                  });
                }}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors ${
                  !tumuActive && selectedSubjectKeys.has(key)
                    ? 'border-transparent bg-primary text-primary-foreground'
                    : 'border-border bg-background hover:bg-accent'
                }`}
              >
                {label}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    !tumuActive && selectedSubjectKeys.has(key)
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {count}
                </span>
              </button>
            ))}
          </div>

          <div className="flex w-full gap-2">
            <button
              type="button"
              onClick={() => handleReviewTabChange('question')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
                reviewKindTab === 'question'
                  ? 'border-transparent bg-primary text-primary-foreground'
                  : 'border-border bg-background'
              }`}
            >
              Sorular
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  reviewKindTab === 'question' ? 'bg-primary-foreground/20' : 'bg-muted text-muted-foreground'
                }`}
              >
                {previewQuestionCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleReviewTabChange('topic')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
                reviewKindTab === 'topic'
                  ? 'border-transparent bg-primary text-primary-foreground'
                  : 'border-border bg-background'
              }`}
            >
              Konular
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  reviewKindTab === 'topic' ? 'bg-primary-foreground/20' : 'bg-muted text-muted-foreground'
                }`}
              >
                {previewTopicCount}
              </span>
            </button>
          </div>

          <Button type="button" className="w-full" onClick={() => void handleCommitFilterStart()}>
            Tekrara Başla
          </Button>
        </div>
      )}

      {showReviewShell && (
        <div ref={reviewSectionRef} className="scroll-mt-4">
          <div className="mx-auto flex w-full max-w-md flex-col items-center space-y-4">
            <div className="flex w-full gap-2">
              <button
                type="button"
                onClick={() => handleReviewTabChange('question')}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
                  reviewKindTab === 'question'
                    ? 'border-transparent bg-primary text-primary-foreground'
                    : 'border-border bg-background'
                }`}
              >
                Sorular
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    reviewKindTab === 'question' ? 'bg-primary-foreground/20' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {sessionQuestionCount}
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleReviewTabChange('topic')}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
                  reviewKindTab === 'topic'
                    ? 'border-transparent bg-primary text-primary-foreground'
                    : 'border-border bg-background'
                }`}
              >
                Konular
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    reviewKindTab === 'topic' ? 'bg-primary-foreground/20' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {sessionTopicCount}
                </span>
              </button>
            </div>

            <div className="flex w-full items-center justify-between">
              <h1>Tekrar Et</h1>
              {items.length > 0 && (
                <span className="text-sm text-muted-foreground">
                  {currentIndex + 1} / {items.length}
                </span>
              )}
            </div>

            {items.length > 0 && (
              <div className="h-2 w-full rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-primary transition-all"
                  style={{ width: `${((currentIndex + 1) / Math.max(1, items.length)) * 100}%` }}
                />
              </div>
            )}

            {items.length === 0 && sessionDuePool.length > 0 && (
              <p className="py-8 text-center text-muted-foreground">
                Bu sekmede tekrar sırasında öğe yok. Diğer sekmeyi seçebilirsin.
              </p>
            )}

            {current && (
              <div className="flex w-full flex-col items-center space-y-4">
                {current.type === 'question' ? (
                  <QuestionCard question={current.data} flipped={flipped} />
                ) : (
                  <TopicCard topic={current.data} showAnswer={showAnswer} />
                )}

                {!showAnswer && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowAnswer(true);
                      setFlipped(true);
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-primary-foreground"
                  >
                    <Eye className="h-5 w-5" />
                    Cevabı Göster
                  </button>
                )}

                {showAnswer && (
                  <div className="w-full space-y-3">
                    <div className="flex gap-3">
                      {current.type === 'question' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void handleSolved(false)}
                            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-100 py-3 text-red-700"
                          >
                            <X className="h-5 w-5" />
                            Çözemedim
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleSolved(true)}
                            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-100 py-3 text-green-700"
                          >
                            <Check className="h-5 w-5" />
                            Çözdüm
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => void handleTopicReview('not_understood')}
                            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-100 py-3 text-red-700"
                          >
                            <X className="h-5 w-5" />
                            Anlamadım
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleTopicReview('understood')}
                            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-100 py-3 text-green-700"
                          >
                            <Check className="h-5 w-5" />
                            Anladım
                          </button>
                        </>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full h-8 text-xs"
                      onClick={() => openEditReviewDialog()}
                    >
                      Tekrar Zamanını Düzenle
                    </Button>
                    {current.type === 'question' && (
                      <button
                        type="button"
                        onClick={() => setDeleteDialogOpen(true)}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-border py-2 text-sm text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                        Sil
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {upcomingDisplayed.length > 0 && (
        <section className="pt-6 border-t border-border mt-8">
          <h2 className="text-lg font-semibold mb-3">Yaklaşan Tekrarlar</h2>
          <ul className="space-y-2">
            {upcomingDisplayed.map(item => (
              <li
                key={`${item.type}-${item.data.id}`}
                className="flex items-start gap-3 rounded-xl border border-border bg-card p-3 text-left"
              >
                {item.type === 'question' ? (
                  <FileQuestion className="w-5 h-5 shrink-0 text-primary mt-0.5" aria-hidden />
                ) : (
                  <BookOpen className="w-5 h-5 shrink-0 text-purple-600 mt-0.5" aria-hidden />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">
                    {item.type === 'question' ? (item.data.subject?.trim() || 'Soru') : item.data.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Tekrar: {new Date(item.data.nextReviewAt).toLocaleDateString('tr-TR')}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 shrink-0 px-2.5 text-xs"
                  onClick={() => handleStartEarlyRepeat(item)}
                >
                  Şimdi Tekrar Et
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function QuestionCard({ question, flipped }: { question: Question; flipped: boolean }) {
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);
  const diffColor = { easy: 'bg-green-100 text-green-800', medium: 'bg-amber-100 text-amber-800', hard: 'bg-red-100 text-red-800' };
  const diffLabel = { easy: 'Kolay', medium: 'Orta', hard: 'Zor' };

  return (
    <div className="perspective-1000 w-full max-w-md">
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
      <div className="relative min-h-[300px] w-full" style={{ transformStyle: 'preserve-3d', transition: 'transform 0.6s', transform: flipped ? 'rotateY(180deg)' : '' }}>
        {/* Front - Question */}
        <button
          type="button"
          className="absolute inset-0 flex cursor-zoom-in flex-col rounded-2xl border border-border bg-card p-4 text-left"
          style={{ backfaceVisibility: 'hidden' }}
          onClick={() => setZoomUrl(question.imageUrl)}
        >
          <div className="mb-3 flex items-center justify-between">
            <span className={`rounded-full px-2 py-0.5 text-xs ${diffColor[question.difficulty]}`}>{diffLabel[question.difficulty]}</span>
            {question.subject && <span className="text-xs text-muted-foreground">{question.subject}</span>}
          </div>
          <img src={question.imageUrl} alt="Soru" className="max-h-[250px] flex-1 rounded-lg object-contain" />
        </button>

        {/* Back - Answer */}
        <div
          className="absolute inset-0 flex flex-col rounded-2xl border border-border bg-card p-4"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          <div className="mb-3 text-xs text-muted-foreground">Cevap</div>
          {question.answerImageUrl ? (
            <button
              type="button"
              className="flex flex-1 cursor-zoom-in flex-col text-left"
              onClick={() => setZoomUrl(question.answerImageUrl!)}
            >
              <img src={question.answerImageUrl} alt="Cevap" className="max-h-[250px] flex-1 rounded-lg object-contain" />
            </button>
          ) : (
            <div className="flex flex-1 items-center justify-center p-4">
              <p className="text-center text-lg">{question.answerText}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TopicCard({ topic, showAnswer }: { topic: Topic; showAnswer: boolean }) {
  return (
    <div className="w-full max-w-md bg-card rounded-2xl border border-border p-5">
      <div className="flex items-center gap-2 mb-3">
        <BookOpen className="w-5 h-5 text-purple-600" />
        <span className="text-xs text-muted-foreground">Konu Tekrarı</span>
      </div>
      <h3 className="mb-3">{topic.title}</h3>
      {showAnswer ? (
        <>
          <p className="text-muted-foreground whitespace-pre-wrap">{topic.notes}</p>
          {topic.imageUrl && <img src={topic.imageUrl} alt="Konu" className="mt-3 rounded-lg max-h-[200px] object-contain" />}
        </>
      ) : null}
    </div>
  );
}
