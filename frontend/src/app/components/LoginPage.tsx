import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../api';

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    try {
      const response = await api.post('/auth/login', { email, password });
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      navigate('/');
    } catch {
      setError('Email veya şifre hatalı');
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🔄</div>
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

            <button
              type="submit"
              className="w-full py-3 rounded-lg bg-primary text-primary-foreground transition-opacity"
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

        <p className="text-center text-xs text-muted-foreground mt-6">
          Verileriniz cihazınızda saklanır. Google Drive entegrasyonu yakında.
        </p>
      </div>
    </div>
  );
}
