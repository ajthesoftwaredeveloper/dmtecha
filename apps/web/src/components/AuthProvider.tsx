'use client';

import type { AuthResponseDto } from '@dmtecha/shared-types';
import { useEffect, useState, useCallback } from 'react';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface AuthState {
  user: AuthResponseDto['user'] | null;
  accessToken: string | null;
}

async function authFetch<T>(endpoint: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { success: boolean; data: T; error?: { message: string } };
  if (!data.success) throw new Error(data.error?.message ?? 'Request failed');
  return data.data;
}

export function AuthProvider({ children }: { children: (auth: AuthState & { signOut: () => void }) => React.ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({ user: null, accessToken: null });
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('auth');
    if (stored) {
      try {
        setAuth(JSON.parse(stored) as AuthState);
      } catch { /* ignore */ }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let result: AuthResponseDto;
      if (mode === 'signup') {
        result = await authFetch<AuthResponseDto>('/auth/signup', { email, password, fullName });
      } else {
        result = await authFetch<AuthResponseDto>('/auth/signin', { email, password });
      }
      const newAuth = { user: result.user, accessToken: result.accessToken };
      setAuth(newAuth);
      localStorage.setItem('auth', JSON.stringify(newAuth));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const signOut = useCallback(() => {
    setAuth({ user: null, accessToken: null });
    localStorage.removeItem('auth');
  }, []);

  if (auth.user && auth.accessToken) {
    return <>{children({ ...auth, signOut })}</>;
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-logo">🧠</div>
        <h1 className="auth-title">Knowledge Base</h1>
        <p className="auth-subtitle">
          {mode === 'signin' ? 'Sign in to your account' : 'Create a new account'}
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'signup' && (
            <input
              type="text"
              placeholder="Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="auth-input"
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="auth-input"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="auth-input"
            required
            minLength={6}
          />
          {error && <p className="auth-error">{error}</p>}
          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? 'Loading...' : mode === 'signin' ? 'Sign In' : 'Sign Up'}
          </button>
        </form>

        <p className="auth-switch">
          {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
          <button
            type="button"
            onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); }}
            className="auth-switch-button"
          >
            {mode === 'signin' ? 'Sign Up' : 'Sign In'}
          </button>
        </p>
      </div>
    </div>
  );
}
