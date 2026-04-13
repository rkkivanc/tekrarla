import React from 'react';
import { useState, useRef, useEffect, useMemo } from 'react';
import { Plus, X, BookOpen, Camera, Calendar, ChevronDown, ChevronRight, FolderOpen, Pencil } from 'lucide-react';
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
  subject: string | null;
  created_at: string;
  next_review_at: string | null;
  review_count: number;
  last_result?: string | null;
};

type TopicWithMeta = Topic & { lastResult?: string | null; subject?: string };

function nextReviewAtFromDays(days: number): string {
  const d0 = Number.isFinite(days) ? Math.floor(days) : 0;
  const d = Math.min(365, Math.max(0, d0));
  return new Date(Date.now() + d * 86400000).toISOString();
}

function capitalizeSubjectLabel(keyLower: string): string {
  if (!keyLower) return '';
  return keyLower.charAt(0).toUpperCase() + keyLower.slice(1);
}

function rowToTopic(row: TopicRow): TopicWithMeta {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes ?? '',
    imageUrl: row.image_url ?? undefined,
    subject: row.subject ?? undefined,
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
  const [topicSubject, setTopicSubject] = useState('');
  const [existingSubjects, setExistingSubjects] = useState<string[]>([]);
  const [subjectDropdownOpen, setSubjectDropdownOpen] = useState(false);
  const subjectComboRef = useRef<HTMLDivElement>(null);
  const [openFolders, setOpenFolders] = useState<Set<string>>(() => new Set());
  const [notes, setNotes] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const fileCameraRef = useRef<HTMLInputElement>(null);
  const fileGalleryRef = useRef<HTMLInputElement>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [idToDelete, setIdToDelete] = useState<string | null>(null);
  const [topicDays, setTopicDays] = useState(3);
  const [topicReviewDialogOpen, setTopicReviewDialogOpen] = useState(false);
  const [topicReviewTargetId, setTopicReviewTargetId] = useState<string | null>(null);
  const [topicReviewDays, setTopicReviewDays] = useState(1);
  const [editingTopic, setEditingTopic] = useState<TopicWithMeta | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editSubject, setEditSubject] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [editSubjectDropdownOpen, setEditSubjectDropdownOpen] = useState(false);
  const editSubjectComboRef = useRef<HTMLDivElement>(null);
  const editFileCameraRef = useRef<HTMLInputElement>(null);
  const editFileGalleryRef = useRef<HTMLInputElement>(null);

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
    if (!editingTopic) return;
    setEditTitle(editingTopic.title);
    setEditSubject(editingTopic.subject ?? '');
    setEditNotes(editingTopic.notes);
    setEditImageUrl(editingTopic.imageUrl ?? '');
    setEditSubjectDropdownOpen(false);
  }, [editingTopic]);

  const filteredSubjects = useMemo(() => {
    const q = topicSubject.trim().toLowerCase();
    if (!q) return existingSubjects;
    return existingSubjects.filter(s => s.toLowerCase().includes(q));
  }, [existingSubjects, topicSubject]);

  const filteredEditSubjects = useMemo(() => {
    const q = editSubject.trim().toLowerCase();
    if (!q) return existingSubjects;
    return existingSubjects.filter(s => s.toLowerCase().includes(q));
  }, [existingSubjects, editSubject]);

  const { subjectGroups, subjectlessTopics } = useMemo(() => {
    const subjectless: TopicWithMeta[] = [];
    const map = new Map<string, TopicWithMeta[]>();
    for (const t of topics) {
      const raw = t.subject?.trim();
      if (!raw) {
        subjectless.push(t);
        continue;
      }
      const key = raw.toLowerCase();
      const arr = map.get(key);
      if (arr) arr.push(t);
      else map.set(key, [t]);
    }
    const subjectGroups = [...map.entries()]
      .map(([key, items]) => ({
        key,
        label: capitalizeSubjectLabel(key),
        items,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'tr'));
    return { subjectGroups, subjectlessTopics: subjectless };
  }, [topics]);

  const toggleFolder = (key: string) => {
    setOpenFolders(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleImageUpload = async (file: File, setUrl?: (url: string) => void) => {
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      });
      const formData = new FormData();
      formData.append('file', compressed, compressed.name || file.name);
      const { data } = await api.post<{ url: string }>('/upload', formData);
      (setUrl ?? setImageUrl)(data.url);
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
      const next_review_at = nextReviewAtFromDays(topicDays);
      const { data } = await api.post<TopicRow>('/topics', {
        title: title.trim(),
        notes: notes.trim(),
        image_url: imageUrl || null,
        next_review_at,
        subject: topicSubject.trim() || null,
      });
      const newTopic = rowToTopic(data);
      setTopics(prev => [newTopic, ...prev]);
      setShowForm(false);
      setTitle('');
      setTopicSubject('');
      setNotes('');
      setImageUrl('');
      setTopicDays(3);
      toast.success('Konu notu eklendi!');
    } catch {
      toast.error('Konu kaydedilemedi');
    }
  };

  const openTopicReviewDialog = (topicId: string) => {
    setTopicReviewTargetId(topicId);
    setTopicReviewDays(1);
    setTopicReviewDialogOpen(true);
  };

  const handleSaveTopicReviewDate = async () => {
    if (!topicReviewTargetId) return;
    const d0 = Number.isFinite(topicReviewDays) ? Math.floor(topicReviewDays) : 1;
    const days = Math.min(365, Math.max(0, d0));
    try {
      const { data } = await api.patch<TopicRow>(`/topics/${topicReviewTargetId}/review-date`, {
        days,
        hours: 0,
        minutes: 0,
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

  const handleSaveTopicContent = async () => {
    if (!editingTopic) return;
    if (!editTitle.trim()) {
      toast.error('Başlık gerekli');
      return;
    }
    try {
      const { data } = await api.patch<TopicRow>(`/topics/${editingTopic.id}/content`, {
        title: editTitle.trim(),
        subject: editSubject.trim() ? editSubject.trim().toLowerCase() : null,
        notes: editNotes,
        image_url: editImageUrl.trim() ? editImageUrl.trim() : null,
      });
      const updated = rowToTopic(data);
      setTopics(prev => prev.map(x => (x.id === updated.id ? updated : x)));
      setEditingTopic(null);
      toast.success('Konu güncellendi');
    } catch (e) {
      console.error(e);
      const msg = isAxiosError(e) ? (e.response?.data as { error?: string })?.error : undefined;
      toast.error(msg ?? 'Konu güncellenemedi');
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
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Ders / Konu (opsiyonel)</label>
            <div className="relative" ref={subjectComboRef}>
              <input
                value={topicSubject}
                onChange={e => {
                  setTopicSubject(e.target.value);
                  setSubjectDropdownOpen(true);
                }}
                onFocus={() => setSubjectDropdownOpen(true)}
                onBlur={() => setTopicSubject(s => s.trim())}
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
                        setTopicSubject(s);
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
            <div>
              <label className="flex flex-col gap-1 text-sm max-w-xs">
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
                  <div className="mt-2 space-y-3">
                    {items.map(t => (
                      <TopicAccordionCard
                        key={t.id}
                        t={t}
                        expandedId={expandedId}
                        setExpandedId={setExpandedId}
                        openTopicReviewDialog={openTopicReviewDialog}
                        onRequestDelete={setIdToDelete}
                        onOpenEdit={setEditingTopic}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {subjectlessTopics.length > 0 && (
            <div className={`space-y-3 ${subjectGroups.length > 0 ? 'mt-4' : ''}`}>
              {subjectlessTopics.map(t => (
                <TopicAccordionCard
                  key={t.id}
                  t={t}
                  expandedId={expandedId}
                  setExpandedId={setExpandedId}
                  openTopicReviewDialog={openTopicReviewDialog}
                  onRequestDelete={setIdToDelete}
                  onOpenEdit={setEditingTopic}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <Dialog
        open={editingTopic !== null}
        onOpenChange={open => {
          if (!open) setEditingTopic(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Konuyu düzenle</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Konu başlığı</label>
              <input
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                placeholder="Konu başlığı"
                className="w-full px-3 py-2 rounded-lg border border-border bg-input-background"
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
              <label className="text-sm text-muted-foreground mb-1 block">Notlar</label>
              <textarea
                value={editNotes}
                onChange={e => setEditNotes(e.target.value)}
                rows={5}
                placeholder="Notlarınızı buraya yazın..."
                className="w-full px-3 py-2 rounded-lg border border-border bg-input-background resize-none"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Fotoğraf</label>
              {editImageUrl ? (
                <div className="relative">
                  <img src={editImageUrl} alt="Not" className="w-full max-h-48 object-contain rounded-lg border border-border" />
                  <button
                    type="button"
                    onClick={() => setEditImageUrl('')}
                    className="absolute top-2 right-2 p-1 rounded-full bg-black/50 text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="w-full py-4 border-2 border-dashed border-border rounded-lg flex flex-col items-center gap-3 text-muted-foreground hover:bg-accent">
                  <Camera className="w-5 h-5 md:hidden" />
                  <button
                    type="button"
                    className="hidden md:inline-flex px-4 py-2 rounded-lg border border-border bg-background text-sm text-foreground"
                    onClick={() => editFileGalleryRef.current?.click()}
                  >
                    Dosya Seç
                  </button>
                  <div className="flex md:hidden w-full flex-col sm:flex-row gap-2 px-4">
                    <button
                      type="button"
                      className="flex-1 py-2 rounded-lg border border-border bg-background text-sm text-foreground"
                      onClick={() => editFileCameraRef.current?.click()}
                    >
                      Fotoğraf Çek
                    </button>
                    <button
                      type="button"
                      className="flex-1 py-2 rounded-lg border border-border bg-background text-sm text-foreground"
                      onClick={() => editFileGalleryRef.current?.click()}
                    >
                      Galeriden Seç
                    </button>
                  </div>
                </div>
              )}
              <input
                ref={editFileCameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={async e => {
                  const file = e.target.files?.[0];
                  if (file) await handleImageUpload(file, setEditImageUrl);
                  e.target.value = '';
                }}
              />
              <input
                ref={editFileGalleryRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async e => {
                  const file = e.target.files?.[0];
                  if (file) await handleImageUpload(file, setEditImageUrl);
                  e.target.value = '';
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditingTopic(null)}>
              İptal
            </Button>
            <Button type="button" onClick={() => void handleSaveTopicContent()}>
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

function TopicAccordionCard({
  t,
  expandedId,
  setExpandedId,
  openTopicReviewDialog,
  onRequestDelete,
  onOpenEdit,
}: {
  t: TopicWithMeta;
  expandedId: string | null;
  setExpandedId: React.Dispatch<React.SetStateAction<string | null>>;
  openTopicReviewDialog: (id: string) => void;
  onRequestDelete: (id: string) => void;
  onOpenEdit: (topic: TopicWithMeta) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setExpandedId(expandedId === t.id ? null : t.id);
          }
        }}
        className="flex w-full cursor-pointer items-center justify-between p-4 text-left"
      >
        <div>
          <h3>{t.title}</h3>
          <span className="block text-xs text-muted-foreground">
            Tekrar: {new Date(t.nextReviewAt).toLocaleDateString('tr-TR')} · {t.reviewCount} tekrar
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              openTopicReviewDialog(t.id);
            }}
            className="inline-flex items-center justify-center rounded-lg border border-border bg-background p-2 text-foreground hover:bg-accent"
            aria-label="Tekrar zamanını ayarla"
          >
            <Calendar className="h-4 w-4" />
          </button>
          <BookOpen className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>
      {expandedId === t.id && (
        <div className="border-t border-border px-4 pb-4 pt-3">
          <p className="whitespace-pre-wrap text-muted-foreground">{t.notes}</p>
          {t.imageUrl && <img src={t.imageUrl} alt="Not" className="mt-3 max-h-48 rounded-lg object-contain" />}
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={() => onOpenEdit(t)}
              className="inline-flex items-center justify-center rounded-lg border border-border bg-background p-2 text-foreground hover:bg-accent"
              aria-label="Konuyu düzenle"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => onRequestDelete(t.id)} className="text-sm text-destructive hover:underline">
              Sil
            </button>
          </div>
        </div>
      )}
      {(t.lastResult === 'understood' || t.lastResult === 'not_understood') && (
        <div className="border-t border-border px-4 pb-3 pt-2 text-xs text-muted-foreground">
          {t.lastResult === 'understood' ? 'Son tekrar: Anladım ✓' : 'Son tekrar: Anlamadım ✗'}
        </div>
      )}
    </div>
  );
}
