import { Outlet, useNavigate, useLocation } from 'react-router';
import { Home, BookOpen, FileQuestion, Mic, Users, LogOut, X, Shield, Settings } from 'lucide-react';
import { type User } from '../store';
import React, { useState, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { ChangePasswordDialog, ChangePasswordForm } from './ChangePasswordDialog';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
};

const PWA_DISMISSED_KEY = 'pwa-dismissed';
const PWA_IOS_DISMISSED_KEY = 'pwa-ios-dismissed';

function isIosDevice(): boolean {
  return typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  // TODO: API call
  // const [user] = useState<User | null>(() => getState().user);
  const [user] = useState<User | null>(() => {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosInstallHint, setShowIosInstallHint] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isIosDevice()) return;
    if (localStorage.getItem(PWA_IOS_DISMISSED_KEY)) return;
    setShowIosInstallHint(true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || localStorage.getItem(PWA_DISMISSED_KEY)) return;
    if (isIosDevice()) return;

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  }, []);

  const dismissPwaBanner = () => {
    localStorage.setItem(PWA_DISMISSED_KEY, '1');
    setDeferredPrompt(null);
  };

  const dismissIosPwaBanner = () => {
    localStorage.setItem(PWA_IOS_DISMISSED_KEY, '1');
    setShowIosInstallHint(false);
  };

  const handlePwaInstall = async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
    } finally {
      dismissPwaBanner();
    }
  };

  if (!user) {
    return null;
  }

  const forcePasswordChange = localStorage.getItem('forcePasswordChange') === 'true';

  const navItems = [
    { path: '/', label: 'Ana Sayfa', icon: Home },
    { path: '/questions', label: 'Sorular', icon: FileQuestion },
    { path: '/review', label: 'Tekrar Et', icon: BookOpen },
    { path: '/topics', label: 'Konular', icon: BookOpen },
    { path: '/voice-notes', label: 'Ses Notları', icon: Mic },
  ];

  if (user.role === 'admin') {
    navItems.push({ path: '/admin', label: 'Admin', icon: Shield });
  }
  if (user.role === 'teacher' || user.role === 'admin') {
    navItems.push({ path: '/teacher', label: 'Öğretmen Paneli', icon: Users });
  }

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {forcePasswordChange && (
        <div className="fixed inset-0 z-[9999] bg-background flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-md space-y-6">
            <h2 className="text-xl font-semibold text-center text-foreground">
              Şifrenizi değiştirmeniz gerekmektedir
            </h2>
            <ChangePasswordForm
              onSuccess={() => {
                window.location.reload();
              }}
            />
          </div>
        </div>
      )}

      {/* Top bar */}
      <header className="bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button className="md:hidden" onClick={() => setMenuOpen(!menuOpen)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
          </button>
          <h1 className="text-xl cursor-pointer" onClick={() => navigate('/')}>
            Tekrarla
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm opacity-80 hidden sm:inline">{user.name}</span>
          <button
            type="button"
            onClick={() => setChangePasswordOpen(true)}
            className="opacity-80 hover:opacity-100"
            title="Şifre değiştir"
          >
            <Settings className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => setLogoutDialogOpen(true)}
            className="opacity-80 hover:opacity-100"
            title="Çıkış"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {showIosInstallHint && (
        <div
          className="bg-card border-b border-border px-4 py-3 flex items-start justify-between gap-3 shrink-0"
          role="region"
          aria-label="Ana ekrana ekleme"
        >
          <p className="text-sm text-foreground flex-1 min-w-0 whitespace-pre-line">
            {`Ana ekrana eklemek için Safari'de\npaylaş ikonuna bas ve 'Ana Ekrana Ekle'yi seç`}
          </p>
          <button
            type="button"
            onClick={dismissIosPwaBanner}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground shrink-0 mt-0.5"
            aria-label="Kapat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {!showIosInstallHint && deferredPrompt && (
        <div
          className="bg-card border-b border-border px-4 py-3 flex items-center justify-between gap-3 shrink-0"
          role="region"
          aria-label="Uygulamayı yükle"
        >
          <p className="text-sm text-foreground flex-1 min-w-0">Tekrarla&apos;yı ana ekrana ekle</p>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handlePwaInstall}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:opacity-90"
            >
              Ekle
            </button>
            <button
              type="button"
              onClick={dismissPwaBanner}
              className="p-1.5 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Kapat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      <ChangePasswordDialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />

      <AlertDialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Çıkış yapmak istediğine emin misin?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">İptal</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              className="bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600"
              onClick={() => handleLogout()}
            >
              Çıkış Yap
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex flex-1">
        {/* Sidebar - desktop */}
        <nav className="hidden md:flex flex-col w-56 bg-card border-r border-border p-3 gap-1">
          {navItems.map(item => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                isActive(item.path) ? 'bg-primary text-primary-foreground' : 'hover:bg-accent text-foreground'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Mobile nav overlay */}
        {menuOpen && (
          <div className="fixed inset-0 z-40 md:hidden" onClick={() => setMenuOpen(false)}>
            <div className="absolute inset-0 bg-black/50" />
            <nav className="absolute left-0 top-0 bottom-0 w-64 bg-card p-3 pt-16 flex flex-col gap-1" onClick={e => e.stopPropagation()}>
              {navItems.map(item => (
                <button
                  key={item.path}
                  onClick={() => { navigate(item.path); setMenuOpen(false); }}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                    isActive(item.path) ? 'bg-primary text-primary-foreground' : 'hover:bg-accent text-foreground'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 p-4 md:p-6 max-w-5xl mx-auto w-full">
          <Outlet />
        </main>
      </div>

      {/* Bottom nav - mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border flex z-50">
        {navItems.slice(0, 5).map(item => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`flex-1 flex flex-col items-center py-2 gap-0.5 ${
              isActive(item.path) ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <item.icon className="w-5 h-5" />
            <span className="text-[10px]">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}