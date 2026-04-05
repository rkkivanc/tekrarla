import { useState, useMemo } from 'react';
import { RotateCcw, Check, X, Eye, EyeOff, Trash2, BookOpen } from 'lucide-react';
import { isDueForReview, getNextReviewDate, type Question, type Topic } from '../store';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

type ReviewItem = { type: 'question'; data: Question } | { type: 'topic'; data: Topic };

export function ReviewPage() {
  const [items, setItems] = useState<ReviewItem[]>(() => {
    // TODO: API call
    // const state = getState();
    // const dueQ = state.questions.filter(q => !q.deleted && isDueForReview(q.nextReviewAt)).map(q => ({ type: 'question' as const, data: q }));
    // const dueT = state.topics.filter(t => isDueForReview(t.nextReviewAt)).map(t => ({ type: 'topic' as const, data: t }));
    // return [...dueQ, ...dueT];
    return [];
  });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [flipped, setFlipped] = useState(false);

  const current = items[currentIndex];

  const handleSolved = (solved: boolean) => {
    if (!current) return;
    // TODO: API call
    // const state = getState();
    //
    // if (current.type === 'question') {
    //   const q = current.data;
    //   const updatedQuestions = state.questions.map(sq => {
    //     if (sq.id !== q.id) return sq;
    //     if (solved) {
    //       return { ...sq, solved: true, reviewCount: sq.reviewCount + 1, nextReviewAt: getNextReviewDate(sq.difficulty) };
    //     } else {
    //       // Failed - restart timer based on difficulty
    //       return { ...sq, reviewCount: sq.reviewCount + 1, nextReviewAt: getNextReviewDate(sq.difficulty) };
    //     }
    //   });
    //   setState({ ...state, questions: updatedQuestions });
    // } else {
    //   const t = current.data;
    //   const updatedTopics = state.topics.map(st => {
    //     if (st.id !== t.id) return st;
    //     return { ...st, reviewCount: st.reviewCount + 1, nextReviewAt: new Date(Date.now() + 3 * 86400000).toISOString() };
    //   });
    //   setState({ ...state, topics: updatedTopics });
    // }

    toast.success(solved ? 'Harika! Başardın! 🎉' : 'Tekrar zamanı ayarlandı');
    next();
  };

  const handleDelete = () => {
    if (!current || current.type !== 'question') return;
    // TODO: API call
    // const state = getState();
    // const updatedQuestions = state.questions.map(q => q.id === current.data.id ? { ...q, deleted: true } : q);
    // setState({ ...state, questions: updatedQuestions });
    toast.success('Soru silindi');
    const newItems = items.filter((_, i) => i !== currentIndex);
    setItems(newItems);
    if (currentIndex >= newItems.length) setCurrentIndex(Math.max(0, newItems.length - 1));
    setShowAnswer(false);
    setFlipped(false);
  };

  const next = () => {
    setShowAnswer(false);
    setFlipped(false);
    const newItems = items.filter((_, i) => i !== currentIndex);
    setItems(newItems);
    if (currentIndex >= newItems.length) setCurrentIndex(Math.max(0, newItems.length - 1));
  };

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center pb-20 md:pb-0">
        <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mb-4">
          <Check className="w-10 h-10 text-green-600" />
        </div>
        <h2>Tebrikler! 🎉</h2>
        <p className="text-muted-foreground mt-2">Şu an tekrar edilecek bir şey yok.</p>
        <p className="text-sm text-muted-foreground mt-1">Yeni sorular ve konular ekleyerek tekrar planını oluştur.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <div className="flex items-center justify-between">
        <h1>Tekrar Et</h1>
        <span className="text-sm text-muted-foreground">{currentIndex + 1} / {items.length}</span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-muted rounded-full h-2">
        <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${((items.length - items.length + currentIndex) / Math.max(1, items.length)) * 100}%` }} />
      </div>

      {current && (
        <div className="flex flex-col items-center">
          {current.type === 'question' ? (
            <QuestionCard question={current.data} showAnswer={showAnswer} flipped={flipped} onFlip={() => { setShowAnswer(true); setFlipped(true); }} />
          ) : (
            <TopicCard topic={current.data} showAnswer={showAnswer} onShow={() => setShowAnswer(true)} />
          )}

          {/* Actions */}
          <div className="mt-6 w-full max-w-md space-y-3">
            {!showAnswer ? (
              <button
                onClick={() => { setShowAnswer(true); setFlipped(true); }}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground flex items-center justify-center gap-2"
              >
                <Eye className="w-5 h-5" />
                Cevabı Göster
              </button>
            ) : (
              <>
                <div className="flex gap-3">
                  <button onClick={() => handleSolved(false)} className="flex-1 py-3 rounded-xl bg-red-100 text-red-700 flex items-center justify-center gap-2">
                    <X className="w-5 h-5" />
                    Çözemedim
                  </button>
                  <button onClick={() => handleSolved(true)} className="flex-1 py-3 rounded-xl bg-green-100 text-green-700 flex items-center justify-center gap-2">
                    <Check className="w-5 h-5" />
                    Çözdüm
                  </button>
                </div>
                {current.type === 'question' && (
                  <div className="flex gap-3">
                    <button onClick={handleDelete} className="flex-1 py-2 rounded-xl border border-border text-destructive flex items-center justify-center gap-2 text-sm">
                      <Trash2 className="w-4 h-4" />
                      Sil
                    </button>
                    <button onClick={() => handleSolved(true)} className="flex-1 py-2 rounded-xl border border-border text-foreground flex items-center justify-center gap-2 text-sm">
                      <RotateCcw className="w-4 h-4" />
                      Tekrar Tekrar Et
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function QuestionCard({ question, showAnswer, flipped, onFlip }: { question: Question; showAnswer: boolean; flipped: boolean; onFlip: () => void }) {
  const diffColor = { easy: 'bg-green-100 text-green-800', medium: 'bg-amber-100 text-amber-800', hard: 'bg-red-100 text-red-800' };
  const diffLabel = { easy: 'Kolay', medium: 'Orta', hard: 'Zor' };

  return (
    <div className="w-full max-w-md perspective-1000" onClick={() => !flipped && onFlip()} style={{ cursor: !flipped ? 'pointer' : 'default' }}>
      <div className="relative w-full min-h-[300px]" style={{ transformStyle: 'preserve-3d', transition: 'transform 0.6s', transform: flipped ? 'rotateY(180deg)' : '' }}>
        {/* Front - Question */}
        <div className="absolute inset-0 bg-card rounded-2xl border border-border p-4 flex flex-col" style={{ backfaceVisibility: 'hidden' }}>
          <div className="flex items-center justify-between mb-3">
            <span className={`text-xs px-2 py-0.5 rounded-full ${diffColor[question.difficulty]}`}>{diffLabel[question.difficulty]}</span>
            {question.subject && <span className="text-xs text-muted-foreground">{question.subject}</span>}
          </div>
          <img src={question.imageUrl} alt="Soru" className="flex-1 object-contain rounded-lg max-h-[250px]" />
          <p className="text-center text-sm text-muted-foreground mt-3">Cevabı görmek için dokun</p>
        </div>

        {/* Back - Answer */}
        <div className="absolute inset-0 bg-card rounded-2xl border border-border p-4 flex flex-col" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
          <div className="text-xs text-muted-foreground mb-3">Cevap</div>
          {question.answerImageUrl ? (
            <img src={question.answerImageUrl} alt="Cevap" className="flex-1 object-contain rounded-lg max-h-[250px]" />
          ) : (
            <div className="flex-1 flex items-center justify-center p-4">
              <p className="text-center text-lg">{question.answerText}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TopicCard({ topic, showAnswer, onShow }: { topic: Topic; showAnswer: boolean; onShow: () => void }) {
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
      ) : (
        <button onClick={onShow} className="w-full py-3 border border-border rounded-lg text-muted-foreground hover:bg-accent">
          Notları görmek için tıkla
        </button>
      )}
    </div>
  );
}
