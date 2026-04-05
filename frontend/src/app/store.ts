// Types and shared helpers

export interface Question {
  id: string;
  imageUrl: string;
  answerImageUrl?: string;
  answerText?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  subject?: string;
  createdAt: string;
  nextReviewAt: string;
  reviewCount: number;
  solved: boolean;
  deleted: boolean;
}

export interface Topic {
  id: string;
  title: string;
  notes: string;
  imageUrl?: string;
  createdAt: string;
  nextReviewAt: string;
  reviewCount: number;
}

export interface VoiceNote {
  id: string;
  title: string;
  audioUrl: string;
  duration: number;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'teacher' | 'student';
  code?: string;
  teacherId?: string;
  avatar?: string;
}

export interface AppState {
  user: User | null;
  questions: Question[];
  topics: Topic[];
  voiceNotes: VoiceNote[];
  students: User[];
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

export function generateStudentCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export function getNextReviewDate(difficulty: 'easy' | 'medium' | 'hard'): string {
  const now = new Date();
  const days = difficulty === 'hard' ? 1 : difficulty === 'medium' ? 3 : 5;
  now.setDate(now.getDate() + days);
  return now.toISOString();
}

export function isDueForReview(dateStr: string): boolean {
  return new Date(dateStr) <= new Date();
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
