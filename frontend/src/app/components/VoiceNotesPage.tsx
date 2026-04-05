import { useState, useRef } from 'react';
import { Mic, Square, Play, Pause, Trash2, Plus } from 'lucide-react';
import { generateId, type VoiceNote } from '../store';
import { toast } from 'sonner';

export function VoiceNotesPage() {
  // TODO: API call
  // const [voiceNotes, setVoiceNotes] = useState<VoiceNote[]>(() => getState().voiceNotes);
  const [voiceNotes, setVoiceNotes] = useState<VoiceNote[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [title, setTitle] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);

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

  const saveRecording = () => {
    if (!recordedUrl || !title.trim()) { toast.error('Lütfen başlık girin'); return; }
    
    // Convert blob URL to data URL for persistence
    fetch(recordedUrl).then(r => r.blob()).then(blob => {
      const reader = new FileReader();
      reader.onload = () => {
        const note: VoiceNote = {
          id: generateId(),
          title,
          audioUrl: reader.result as string,
          duration: recordingTime,
          createdAt: new Date().toISOString(),
        };
        // TODO: API call
        // const state = getState();
        // const updated = { ...state, voiceNotes: [...state.voiceNotes, note] };
        // setState(updated);
        // setVoiceNotes(updated.voiceNotes);
        setVoiceNotes(prev => [...prev, note]);
        setTitle(''); setRecordedUrl(null); setShowForm(false); setRecordingTime(0);
        toast.success('Ses kaydı kaydedildi!');
      };
      reader.readAsDataURL(blob);
    });
  };

  const handleDelete = (id: string) => {
    // TODO: API call
    // const state = getState();
    // const updated = { ...state, voiceNotes: state.voiceNotes.filter(v => v.id !== id) };
    // setState(updated);
    // setVoiceNotes(updated.voiceNotes);
    setVoiceNotes(prev => prev.filter(v => v.id !== id));
    toast.success('Ses kaydı silindi');
  };

  const togglePlay = (note: VoiceNote) => {
    if (playingId === note.id) {
      audioRef.current?.pause();
      setPlayingId(null);
    } else {
      if (audioRef.current) audioRef.current.pause();
      const audio = new Audio(note.audioUrl);
      audio.onended = () => setPlayingId(null);
      audio.play();
      audioRef.current = audio;
      setPlayingId(note.id);
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

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
                  <button onClick={() => { const a = new Audio(recordedUrl); a.play(); }} className="p-2 rounded-full bg-primary text-primary-foreground">
                    <Play className="w-4 h-4" />
                  </button>
                  <span className="text-sm">Kayıt - {formatTime(recordingTime)}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setRecordedUrl(null); setRecordingTime(0); }} className="flex-1 py-2 rounded-lg border border-border text-sm">Tekrar Kaydet</button>
                  <button onClick={saveRecording} className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm">Kaydet</button>
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
          {voiceNotes.map(note => (
            <div key={note.id} className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
              <button onClick={() => togglePlay(note)} className="p-3 rounded-full bg-primary text-primary-foreground shrink-0">
                {playingId === note.id ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </button>
              <div className="flex-1 min-w-0">
                <div className="truncate">{note.title}</div>
                <div className="text-xs text-muted-foreground">{formatTime(note.duration)} · {new Date(note.createdAt).toLocaleDateString('tr-TR')}</div>
              </div>
              <button onClick={() => handleDelete(note.id)} className="p-2 text-muted-foreground hover:text-destructive">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
