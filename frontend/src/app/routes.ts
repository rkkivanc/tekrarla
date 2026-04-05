import { createBrowserRouter } from 'react-router';
import { Layout } from './components/Layout';
import { LoginPage } from './components/LoginPage';
import { RegisterPage } from './components/RegisterPage';
import { Dashboard } from './components/Dashboard';
import { QuestionsPage } from './components/QuestionsPage';
import { ReviewPage } from './components/ReviewPage';
import { TopicsPage } from './components/TopicsPage';
import { VoiceNotesPage } from './components/VoiceNotesPage';
import { TeacherPanel } from './components/TeacherPanel';

export const router = createBrowserRouter([
  { path: '/login', Component: LoginPage },
  { path: '/register', Component: RegisterPage },
  {
    path: '/',
    Component: Layout,
    children: [
      { index: true, Component: Dashboard },
      { path: 'questions', Component: QuestionsPage },
      { path: 'review', Component: ReviewPage },
      { path: 'topics', Component: TopicsPage },
      { path: 'voice-notes', Component: VoiceNotesPage },
      { path: 'teacher', Component: TeacherPanel },
    ],
  },
]);
