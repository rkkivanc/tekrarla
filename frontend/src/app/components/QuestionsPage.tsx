import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, Plus, X } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import type { Question } from '../store';
import { api } from '../api';
import { toast } from 'sonner';

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

function mapRowToQuestion(row: QuestionApiRow): Question {
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

export function QuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [questionImg, setQuestionImg] = useState('');
  const [answerImg, setAnswerImg] = useState('');
  const [answerText, setAnswerText] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [subject, setSubject] = useState('');
  const [answerType, setAnswerType] = useState<'text' | 'image'>('text');
  const qInputRef = useRef<HTMLInputElement>(null);
  const aInputRef = useRef<HTMLInputElement>(null);

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
      await api.post('/questions', {
        image_url: questionImg,
        answer_image_url: answerImg,
        answer_text: answerText,
        difficulty,
        subject,
      });
      await refreshQuestions();
      setShowForm(false);
      setQuestionImg('');
      setAnswerImg('');
      setAnswerText('');
      setSubject('');
      setDifficulty('medium');
      toast.success('Soru eklendi! Tekrar tarihi belirlendi.');
    } catch (e) {
      console.error(e);
      toast.error('Soru kaydedilemedi');
    }
  };

  const handleDeleteQuestion = async (id: string) => {
    try {
      await api.delete(`/questions/${id}`);
      setQuestions(prev => prev.filter(q => q.id !== id));
    } catch (e) {
      console.error(e);
      toast.error('Soru silinemedi');
    }
  };

  const difficultyLabel = { easy: 'Kolay (5 gün)', medium: 'Orta (3 gün)', hard: 'Zor (1 gün)' };
  const difficultyColor = { easy: 'bg-green-100 text-green-800 border-green-300', medium: 'bg-amber-100 text-amber-800 border-amber-300', hard: 'bg-red-100 text-red-800 border-red-300' };

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
              <button onClick={() => qInputRef.current?.click()} className="w-full py-8 border-2 border-dashed border-border rounded-lg flex flex-col items-center gap-2 hover:bg-accent transition-colors">
                <Camera className="w-8 h-8 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Fotoğraf çek veya yükle</span>
              </button>
            )}
            <input ref={qInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0], setQuestionImg)} />
          </div>

          {/* Subject */}
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Ders / Konu (opsiyonel)</label>
            <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Örn: Matematik, Fizik..." className="w-full px-3 py-2 rounded-lg border border-border bg-input-background" />
          </div>

          {/* Difficulty */}
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Zorluk *</label>
            <div className="flex gap-2">
              {(['hard', 'medium', 'easy'] as const).map(d => (
                <button key={d} onClick={() => setDifficulty(d)} className={`flex-1 py-2 rounded-lg border text-sm transition-colors ${difficulty === d ? difficultyColor[d] : 'border-border hover:bg-accent'}`}>
                  {difficultyLabel[d]}
                </button>
              ))}
            </div>
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
                <button onClick={() => aInputRef.current?.click()} className="w-full py-8 border-2 border-dashed border-border rounded-lg flex flex-col items-center gap-2 hover:bg-accent transition-colors">
                  <Camera className="w-8 h-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Cevap fotoğrafı yükle</span>
                </button>
              )}
              <input ref={aInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0], setAnswerImg)} />
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
                <button
                  type="button"
                  onClick={() => handleDeleteQuestion(q.id)}
                  className="absolute top-2 right-2 p-1 rounded-full bg-black/50 text-white hover:bg-black/70"
                  aria-label="Soruyu sil"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-3">
                <div className="flex items-center justify-between">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${difficultyColor[q.difficulty]}`}>
                    {q.difficulty === 'hard' ? 'Zor' : q.difficulty === 'medium' ? 'Orta' : 'Kolay'}
                  </span>
                  {q.subject && <span className="text-xs text-muted-foreground">{q.subject}</span>}
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  Tekrar: {new Date(q.nextReviewAt).toLocaleDateString('tr-TR')} · {q.reviewCount} tekrar
                </div>
              </div>
            </div>
          ))}
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
