import { useState } from 'react';
import { Plus, Copy, Eye, Trash2, Users, FileQuestion, BookOpen, Mic } from 'lucide-react';
import { generateId, generateStudentCode, type User } from '../store';
import { toast } from 'sonner';

export function TeacherPanel() {
  // TODO: API call
  // const [students, setStudents] = useState<User[]>(() => getState().students);
  const [students, setStudents] = useState<User[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<User | null>(null);

  const handleAddStudent = () => {
    if (!name.trim()) { toast.error('Öğrenci adı gerekli'); return; }
    // TODO: API call
    // const state = getState();
    const student: User = {
      id: generateId(),
      name,
      email: email || `${name.toLowerCase().replace(/\s/g, '')}@ogrenci`,
      role: 'student',
      code: generateStudentCode(),
      teacherId: undefined,
    };
    // const updated = { ...state, students: [...state.students, student] };
    // setState(updated);
    // setStudents(updated.students);
    setStudents(prev => [...prev, student]);
    setName(''); setEmail(''); setShowAdd(false);
    toast.success(`Öğrenci eklendi! Kod: ${student.code}`);
  };

  const handleDelete = (id: string) => {
    // TODO: API call
    // const state = getState();
    // const updated = { ...state, students: state.students.filter(s => s.id !== id) };
    // setState(updated);
    // setStudents(updated.students);
    setStudents(prev => prev.filter(s => s.id !== id));
    toast.success('Öğrenci silindi');
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Kod kopyalandı!');
  };

  // Mock student data for viewing
  const mockStudentData = {
    questions: Math.floor(Math.random() * 20),
    topics: Math.floor(Math.random() * 10),
    voiceNotes: Math.floor(Math.random() * 5),
    reviewsDone: Math.floor(Math.random() * 50),
  };

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <div className="flex items-center justify-between">
        <h1>Öğretmen Paneli</h1>
        <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground">
          <Plus className="w-4 h-4" /> Öğrenci Ekle
        </button>
      </div>

      {showAdd && (
        <div className="bg-card rounded-xl border border-border p-5 space-y-4">
          <h3>Yeni Öğrenci Ekle</h3>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Öğrenci adı *" className="w-full px-3 py-2 rounded-lg border border-border bg-input-background" />
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="E-posta (opsiyonel)" className="w-full px-3 py-2 rounded-lg border border-border bg-input-background" />
          <p className="text-xs text-muted-foreground">Öğrenciye otomatik bir giriş kodu atanacak</p>
          <div className="flex gap-2">
            <button onClick={() => setShowAdd(false)} className="flex-1 py-2 rounded-lg border border-border">İptal</button>
            <button onClick={handleAddStudent} className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground">Ekle</button>
          </div>
        </div>
      )}

      {selectedStudent ? (
        <div className="bg-card rounded-xl border border-border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2>{selectedStudent.name}</h2>
            <button onClick={() => setSelectedStudent(null)} className="text-sm text-muted-foreground hover:text-foreground">← Geri</button>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Kod: <span className="font-mono bg-muted px-2 py-0.5 rounded">{selectedStudent.code}</span></span>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="p-3 rounded-lg bg-blue-50 text-blue-700">
              <FileQuestion className="w-5 h-5 mb-1" />
              <div className="text-xl">{mockStudentData.questions}</div>
              <div className="text-xs">Soru</div>
            </div>
            <div className="p-3 rounded-lg bg-purple-50 text-purple-700">
              <BookOpen className="w-5 h-5 mb-1" />
              <div className="text-xl">{mockStudentData.topics}</div>
              <div className="text-xs">Konu</div>
            </div>
            <div className="p-3 rounded-lg bg-pink-50 text-pink-700">
              <Mic className="w-5 h-5 mb-1" />
              <div className="text-xl">{mockStudentData.voiceNotes}</div>
              <div className="text-xs">Ses Kaydı</div>
            </div>
            <div className="p-3 rounded-lg bg-green-50 text-green-700">
              <Eye className="w-5 h-5 mb-1" />
              <div className="text-xl">{mockStudentData.reviewsDone}</div>
              <div className="text-xs">Tekrar</div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {students.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center mb-3">
                <Users className="w-8 h-8" />
              </div>
              <p>Henüz öğrenci eklemediniz</p>
              <p className="text-sm">Öğrenci ekleyerek takip etmeye başlayın</p>
            </div>
          ) : (
            <div className="space-y-3">
              {students.map(s => (
                <div key={s.id} className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                    {s.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{s.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      Kod: <span className="font-mono bg-muted px-1.5 py-0.5 rounded">{s.code}</span>
                      <button onClick={() => copyCode(s.code!)} className="hover:text-foreground"><Copy className="w-3 h-3" /></button>
                    </div>
                  </div>
                  <button onClick={() => setSelectedStudent(s)} className="p-2 text-muted-foreground hover:text-foreground">
                    <Eye className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(s.id)} className="p-2 text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
