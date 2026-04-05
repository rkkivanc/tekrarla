import { createElement, useEffect } from 'react';
import { createBrowserRouter, Outlet, useNavigate } from 'react-router';
import { Layout } from './components/Layout';
import { LoginPage } from './components/LoginPage';
import { RegisterPage } from './components/RegisterPage';
import { Dashboard } from './components/Dashboard';
import { QuestionsPage } from './components/QuestionsPage';
import { ReviewPage } from './components/ReviewPage';
import { TopicsPage } from './components/TopicsPage';
import { VoiceNotesPage } from './components/VoiceNotesPage';
import { TeacherPanel } from './components/TeacherPanel';

function TeacherRoute() {
  const navigate = useNavigate();
  const raw = localStorage.getItem('user');
  let role: string | undefined;
  try {
    const user = raw ? (JSON.parse(raw) as { role?: string }) : null;
    role = user?.role;
  } catch {
    role = undefined;
  }

  useEffect(() => {
    if (role !== 'teacher') {
      navigate('/');
    }
  }, [navigate, role]);

  if (role !== 'teacher') {
    return null;
  }
  return createElement(Outlet);
}

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
      {
        path: 'teacher',
        Component: TeacherRoute,
        children: [{ index: true, Component: TeacherPanel }],
      },
    ],
  },
]);
