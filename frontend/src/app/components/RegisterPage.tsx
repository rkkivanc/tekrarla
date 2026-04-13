import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../api';

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '';

export function RegisterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const turnstileWidgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;

    const scriptSrc = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    let script = document.querySelector(`script[src="${scriptSrc}"]`) as HTMLScriptElement | null;

    const mountWidget = () => {
      if (!window.turnstile) return;
      turnstileWidgetIdRef.current = window.turnstile.render('#turnstile-widget', {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (token: string) => setTurnstileToken(token),
        'expired-callback': () => setTurnstileToken(''),
      });
    };

    if (!script) {
      script = document.createElement('script');
      script.src = scriptSrc;
      script.async = true;
      document.head.appendChild(script);
    }

    if (window.turnstile) {
      mountWidget();
    } else {
      script.addEventListener('load', mountWidget, { once: true });
    }

    return () => {
      script?.removeEventListener('load', mountWidget);
      const id = turnstileWidgetIdRef.current;
      if (id && window.turnstile?.remove) {
        window.turnstile.remove(id);
      }
      turnstileWidgetIdRef.current = null;
      setTurnstileToken('');
    };
  }, []);

  function resetTurnstile() {
    setTurnstileToken('');
    const id = turnstileWidgetIdRef.current;
    if (id && window.turnstile) {
      window.turnstile.reset(id);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Şifreler eşleşmiyor');
      resetTurnstile();
      return;
    }
    try {
      const response = await api.post('/auth/register', {
        name,
        email,
        password,
        role: 'student',
        turnstileToken,
      });
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      resetTurnstile();
      navigate('/');
    } catch {
      setError('Kayıt başarısız, tekrar deneyin');
      resetTurnstile();
    }
  }

  const submitDisabled = !turnstileToken;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl mb-2">Tekrarla</h1>
          <p className="text-muted-foreground">Aralıklı tekrar ile öğrenmeyi güçlendir</p>
        </div>

        <div className="bg-card rounded-xl border border-border p-6">
          <form className="space-y-4" onSubmit={handleRegister}>
            <h2 className="text-center mb-2">Kayıt</h2>

            <div>
              <label htmlFor="register-name" className="text-sm text-muted-foreground mb-1 block">
                Ad Soyad
              </label>
              <input
                id="register-name"
                type="text"
                value={name}
                onChange={e => {
                  setName(e.target.value);
                  setError('');
                }}
                autoComplete="name"
                placeholder="Adınız Soyadınız"
                className="w-full px-4 py-3 rounded-lg border border-border bg-input-background"
              />
            </div>

            <div>
              <label htmlFor="register-email" className="text-sm text-muted-foreground mb-1 block">
                E-posta
              </label>
              <input
                id="register-email"
                type="email"
                value={email}
                onChange={e => {
                  setEmail(e.target.value);
                  setError('');
                }}
                autoComplete="email"
                placeholder="ornek@email.com"
                className="w-full px-4 py-3 rounded-lg border border-border bg-input-background"
              />
            </div>

            <div>
              <label htmlFor="register-password" className="text-sm text-muted-foreground mb-1 block">
                Şifre
              </label>
              <input
                id="register-password"
                type="password"
                value={password}
                onChange={e => {
                  setPassword(e.target.value);
                  setError('');
                }}
                autoComplete="new-password"
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-lg border border-border bg-input-background"
              />
            </div>

            <div>
              <label htmlFor="register-confirm-password" className="text-sm text-muted-foreground mb-1 block">
                Şifre tekrar
              </label>
              <input
                id="register-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={e => {
                  setConfirmPassword(e.target.value);
                  setError('');
                }}
                autoComplete="new-password"
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-lg border border-border bg-input-background"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div id="turnstile-widget" className="flex justify-center" />

            <button
              type="submit"
              disabled={submitDisabled}
              className="w-full py-3 rounded-lg bg-primary text-primary-foreground transition-opacity disabled:opacity-50 disabled:pointer-events-none"
            >
              Kayıt Ol
            </button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Zaten hesabın var mı?{' '}
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="text-primary underline-offset-4 hover:underline p-0 bg-transparent border-0 cursor-pointer font-inherit text-sm"
            >
              Giriş yap
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
