import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { FileQuestion, BookOpen, Mic, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { isDueForReview, type Question, type Topic, type VoiceNote, type User } from '../store';

export function Dashboard() {
  const navigate = useNavigate();
  // TODO: API call
  // const state = getState();
  const questions = [] as Question[];
  const topics = [] as Topic[];
  const voiceNotes = [] as VoiceNote[];
  const user = null as User | null;

  const stats = useMemo(() => {
    const activeQuestions = questions.filter(q => !q.deleted);
    const dueQuestions = activeQuestions.filter(q => isDueForReview(q.nextReviewAt));
    const dueTopics = topics.filter(t => isDueForReview(t.nextReviewAt));
    const solvedQuestions = activeQuestions.filter(q => q.solved);
    const totalReviews = activeQuestions.reduce((sum, q) => sum + q.reviewCount, 0) + topics.reduce((sum, t) => sum + t.reviewCount, 0);

    return {
      totalQuestions: activeQuestions.length,
      dueQuestions: dueQuestions.length,
      totalTopics: topics.length,
      dueTopics: dueTopics.length,
      totalVoiceNotes: voiceNotes.length,
      solvedQuestions: solvedQuestions.length,
      totalReviews,
      hard: activeQuestions.filter(q => q.difficulty === 'hard').length,
      medium: activeQuestions.filter(q => q.difficulty === 'medium').length,
      easy: activeQuestions.filter(q => q.difficulty === 'easy').length,
    };
  }, [questions, topics, voiceNotes]);

  const totalDue = stats.dueQuestions + stats.dueTopics;

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div>
        <h1 className="text-2xl">Hoş geldin, {user?.name ?? '…'} 👋</h1>
        <p className="text-muted-foreground mt-1">Bugün tekrar etmen gereken {totalDue} öğe var.</p>
      </div>

      {/* Due alert */}
      {totalDue > 0 && (
        <button
          onClick={() => navigate('/review')}
          className="w-full flex items-center gap-4 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 hover:bg-amber-100 transition-colors"
        >
          <AlertTriangle className="w-8 h-8 text-amber-500 shrink-0" />
          <div className="text-left">
            <div className="text-lg">Tekrar Zamanı!</div>
            <div className="text-sm opacity-80">{stats.dueQuestions} soru ve {stats.dueTopics} konu tekrar bekliyor</div>
          </div>
        </button>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={FileQuestion} label="Toplam Soru" value={stats.totalQuestions} color="bg-blue-50 text-blue-700" />
        <StatCard icon={CheckCircle} label="Çözülen" value={stats.solvedQuestions} color="bg-green-50 text-green-700" />
        <StatCard icon={BookOpen} label="Konu Notu" value={stats.totalTopics} color="bg-purple-50 text-purple-700" />
        <StatCard icon={Mic} label="Ses Kaydı" value={stats.totalVoiceNotes} color="bg-pink-50 text-pink-700" />
      </div>

      {/* Difficulty breakdown */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h2 className="mb-4">Zorluk Dağılımı</h2>
        <div className="space-y-3">
          <DifficultyBar label="Zor" count={stats.hard} total={stats.totalQuestions} color="bg-red-500" />
          <DifficultyBar label="Orta" count={stats.medium} total={stats.totalQuestions} color="bg-amber-500" />
          <DifficultyBar label="Kolay" count={stats.easy} total={stats.totalQuestions} color="bg-green-500" />
        </div>
      </div>

      {/* Activity */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h2 className="mb-2">Genel İstatistikler</h2>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-muted-foreground" />
            <div>
              <div className="text-2xl">{stats.totalReviews}</div>
              <div className="text-sm text-muted-foreground">Toplam Tekrar</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <div>
              <div className="text-2xl">{totalDue}</div>
              <div className="text-sm text-muted-foreground">Bekleyen Tekrar</div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <QuickAction icon={FileQuestion} label="Soru Ekle" onClick={() => navigate('/questions')} />
        <QuickAction icon={BookOpen} label="Konu Ekle" onClick={() => navigate('/topics')} />
        <QuickAction icon={Mic} label="Ses Kaydet" onClick={() => navigate('/voice-notes')} />
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <div className={`rounded-xl p-4 ${color}`}>
      <Icon className="w-6 h-6 mb-2" />
      <div className="text-2xl">{value}</div>
      <div className="text-sm opacity-80">{label}</div>
    </div>
  );
}

function DifficultyBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-12 text-sm">{label}</span>
      <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-sm text-right text-muted-foreground">{count}</span>
    </div>
  );
}

function QuickAction({ icon: Icon, label, onClick }: { icon: any; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border hover:bg-accent transition-colors">
      <Icon className="w-5 h-5" />
      <span>{label}</span>
    </button>
  );
}
