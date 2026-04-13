import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { isAxiosError } from 'axios';
import { api } from '../api';

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '';

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    try {
      const response = await api.post('/auth/login', { email, password, turnstileToken });
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      resetTurnstile();
      navigate('/');
    } catch (err) {
      const apiError =
        isAxiosError(err) && err.response?.data && typeof (err.response.data as { error?: unknown }).error === 'string'
          ? (err.response.data as { error: string }).error
          : '';
      if (apiError === 'Bot doğrulaması gerekli' || apiError === 'Bot doğrulaması başarısız') {
        setError('Güvenlik doğrulaması başarısız. Lütfen sayfayı yenileyip tekrar deneyin.');
      } else {
        setError('E-posta veya şifre hatalı');
      }
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
          <form className="space-y-4" onSubmit={handleLogin}>
            <h2 className="text-center mb-2">Giriş</h2>

            <div>
              <label htmlFor="login-email" className="text-sm text-muted-foreground mb-1 block">
                E-posta
              </label>
              <input
                id="login-email"
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
              <label htmlFor="login-password" className="text-sm text-muted-foreground mb-1 block">
                Şifre
              </label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={e => {
                  setPassword(e.target.value);
                  setError('');
                }}
                autoComplete="current-password"
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
              Giriş Yap
            </button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Hesabın yok mu?{' '}
            <button
              type="button"
              onClick={() => navigate('/register')}
              className="text-primary underline-offset-4 hover:underline p-0 bg-transparent border-0 cursor-pointer font-inherit text-sm"
            >
              Kayıt ol
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
