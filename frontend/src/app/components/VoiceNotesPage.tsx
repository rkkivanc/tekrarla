import { useState, useRef, useEffect, useReducer } from 'react';
import { Mic, Square, Play, Pause, Trash2, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import type { VoiceNote } from '../store';
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

type VoiceNoteRow = {
  id: string;
  title: string;
  audio_url: string;
  duration: number | null;
  created_at: string;
};

type ListedVoiceNote = Omit<VoiceNote, 'audioUrl'> & { audio_url: string };

function rowToVoiceNote(row: VoiceNoteRow): ListedVoiceNote {
  return {
    id: row.id,
    title: row.title,
    audio_url: row.audio_url,
    duration: row.duration ?? 0,
    createdAt: row.created_at,
  };
}

export function VoiceNotesPage() {
  const [voiceNotes, setVoiceNotes] = useState<ListedVoiceNote[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [title, setTitle] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [currentTimeMap, setCurrentTimeMap] = useState<Map<string, number>>(() => new Map());
  const [durationMap, setDurationMap] = useState<Map<string, number>>(() => new Map());
  const [, bumpAudioUi] = useReducer((x: number) => x + 1, 0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const audioMapRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [idToDelete, setIdToDelete] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      audioMapRef.current.forEach(a => {
        a.pause();
        a.src = '';
        a.removeAttribute('src');
      });
      audioMapRef.current.clear();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get<VoiceNoteRow[]>('/voice-notes');
        if (!cancelled) setVoiceNotes(data.map(rowToVoiceNote));
      } catch {
        if (!cancelled) toast.error('Ses notları yüklenemedi');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setRecordedUrl(url);
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = window.setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch {
      toast.error('Mikrofon erişimi reddedildi');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const saveRecording = async () => {
    if (!recordedUrl || !title.trim()) { toast.error('Lütfen başlık girin'); return; }
    if (saving) return;

    setSaving(true);
    try {
      const res = await fetch(recordedUrl);
      const blob = await res.blob();
      const webmBlob = blob.type === 'audio/webm' ? blob : new Blob([blob], { type: 'audio/webm' });
      const formData = new FormData();
      formData.append('file', webmBlob, 'recording.webm');

      const { data: uploadData } = await api.post<{ url: string }>('/upload', formData);

      const { data: row } = await api.post<VoiceNoteRow>('/voice-notes', {
        title: title.trim(),
        audio_url: uploadData.url,
        duration: recordingTime,
      });

      const note = rowToVoiceNote(row);
      setVoiceNotes(prev => [note, ...prev]);
      URL.revokeObjectURL(recordedUrl);
      setTitle('');
      setRecordedUrl(null);
      setShowForm(false);
      setRecordingTime(0);
      toast.success('Ses kaydı kaydedildi!');
    } catch {
      toast.error('Kayıt kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/voice-notes/${id}`);
      const a = audioMapRef.current.get(id);
      if (a) {
        a.pause();
        a.src = '';
        a.removeAttribute('src');
        audioMapRef.current.delete(id);
      }
      setCurrentTimeMap(m => {
        const n = new Map(m);
        n.delete(id);
        return n;
      });
      setDurationMap(m => {
        const n = new Map(m);
        n.delete(id);
        return n;
      });
      setVoiceNotes(prev => prev.filter(v => v.id !== id));
      setIdToDelete(null);
      toast.success('Ses kaydı silindi');
    } catch {
      toast.error('Silinemedi');
    }
  };

  const togglePlay = (note: ListedVoiceNote) => {
    const id = note.id;
    let audio = audioMapRef.current.get(id);

    if (!audio) {
      const audioSrc = note.audio_url.startsWith('http')
        ? note.audio_url
        : `http://localhost:3000/api/upload/${note.audio_url}`;
      audio = new Audio(audioSrc);
      audio.preload = 'metadata';

      audio.ontimeupdate = () => {
        setCurrentTimeMap(prev => new Map(prev).set(id, audio!.currentTime));
      };
      audio.onloadedmetadata = () => {
        const d = Number.isFinite(audio!.duration) && audio!.duration > 0 ? audio!.duration : 0;
        setDurationMap(prev => new Map(prev).set(id, d));
      };
      audio.onplay = () => bumpAudioUi();
      audio.onpause = () => bumpAudioUi();
      audio.onended = () => {
        setCurrentTimeMap(prev => new Map(prev).set(id, 0));
        bumpAudioUi();
      };

      audioMapRef.current.set(id, audio);
    }

    if (!audio.paused) {
      audio.pause();
    } else {
      void audio.play();
    }
  };

  const formatTime = (s: number) => {
    const sec = Math.max(0, Math.floor(s));
    return `${Math.floor(sec / 60).toString().padStart(2, '0')}:${(sec % 60).toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <div className="flex items-center justify-between">
        <h1>Ses Notları</h1>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground">
          {showForm ? 'İptal' : <><Plus className="w-4 h-4" /> Kaydet</>}
        </button>
      </div>

      {showForm && (
        <div className="bg-card rounded-xl border border-border p-5 space-y-4">
          <h3>Yeni Ses Kaydı</h3>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Kayıt başlığı" className="w-full px-3 py-2 rounded-lg border border-border bg-input-background" />

          <div className="flex flex-col items-center gap-4 py-4">
            {isRecording && (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                <span className="text-lg tabular-nums">{formatTime(recordingTime)}</span>
              </div>
            )}

            {!recordedUrl ? (
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors ${isRecording ? 'bg-red-500 text-white' : 'bg-primary text-primary-foreground'}`}
              >
                {isRecording ? <Square className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </button>
            ) : (
              <div className="space-y-3 w-full">
                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  <button onClick={() => { const a = new Audio(recordedUrl); void a.play(); }} className="p-2 rounded-full bg-primary text-primary-foreground">
                    <Play className="w-4 h-4" />
                  </button>
                  <span className="text-sm">Kayıt - {formatTime(recordingTime)}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setRecordedUrl(null); setRecordingTime(0); }} className="flex-1 py-2 rounded-lg border border-border text-sm">Tekrar Kaydet</button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void saveRecording()}
                    className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm disabled:opacity-50"
                  >
                    Kaydet
                  </button>
                </div>
              </div>
            )}

            {!isRecording && !recordedUrl && (
              <p className="text-sm text-muted-foreground">Kayda başlamak için mikrofon butonuna basın</p>
            )}
          </div>
        </div>
      )}

      {voiceNotes.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center mb-3">
            <Mic className="w-8 h-8" />
          </div>
          <p>Henüz ses kaydı yok</p>
        </div>
      ) : (
        <div className="space-y-3">
          {voiceNotes.map(note => {
            const audio = audioMapRef.current.get(note.id);
            const isPlaying = audio !== undefined && !audio.paused;
            let duration = durationMap.get(note.id) ?? 0;
            if (duration <= 0 && audio && Number.isFinite(audio.duration) && audio.duration > 0) {
              duration = audio.duration;
            }
            if (duration <= 0) {
              duration = note.duration ?? 0;
            }
            const currentTime = currentTimeMap.get(note.id) ?? (audio?.currentTime ?? 0);
            const rangeMax = Math.max(duration, 0.001);

            return (
              <div key={note.id} className="bg-card rounded-xl border border-border p-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => togglePlay(note)}
                  className="p-3 rounded-full bg-primary text-primary-foreground shrink-0 self-start"
                  aria-label={isPlaying ? 'Duraklat' : 'Oynat'}
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                </button>
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="truncate font-medium">{note.title}</div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const audio = audioMapRef.current.get(note.id);
                        if (!audio) return;
                        audio.currentTime = Math.max(0, audio.currentTime - 5);
                        setCurrentTimeMap(prev => new Map(prev).set(note.id, audio.currentTime));
                      }}
                      className="shrink-0 flex items-center gap-0.5 px-2 py-1 rounded-md border border-border text-xs tabular-nums hover:bg-muted"
                      aria-label="5 saniye geri"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      5s
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={rangeMax}
                      step="any"
                      value={Math.min(Math.max(0, currentTime), rangeMax)}
                      onChange={e => {
                        const audio = audioMapRef.current.get(note.id);
                        const v = Number(e.target.value);
                        if (audio) {
                          audio.currentTime = v;
                          setCurrentTimeMap(prev => new Map(prev).set(note.id, v));
                        }
                      }}
                      className="flex-1 min-w-0 h-2 accent-primary"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const audio = audioMapRef.current.get(note.id);
                        if (!audio) return;
                        const t = audio.currentTime + 5;
                        audio.currentTime =
                          Number.isFinite(audio.duration) && audio.duration > 0 ? Math.min(audio.duration, t) : t;
                        setCurrentTimeMap(prev => new Map(prev).set(note.id, audio.currentTime));
                      }}
                      className="shrink-0 flex items-center gap-0.5 px-2 py-1 rounded-md border border-border text-xs tabular-nums hover:bg-muted"
                      aria-label="5 saniye ileri"
                    >
                      5s
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{new Date(note.createdAt).toLocaleDateString('tr-TR')}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setIdToDelete(note.id)}
                  className="p-2 text-muted-foreground hover:text-destructive shrink-0 self-start"
                  aria-label="Sil"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog open={idToDelete !== null} onOpenChange={(open) => { if (!open) setIdToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bu ses kaydını silmek istediğine emin misin?</AlertDialogTitle>
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
