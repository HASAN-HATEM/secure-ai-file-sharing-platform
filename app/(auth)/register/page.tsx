'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { signIn } from 'next-auth/react';

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      const form = new FormData(e.currentTarget);
      const name = String(form.get('name') || '');
      const email = String(form.get('email') || '').toLowerCase().trim();
      const password = String(form.get('password') || '');
      const confirm = form.get('confirm');
      if (password !== confirm) {
        setError('Passwords do not match');
        setLoading(false);
        return;
      }
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ name, email, password }),
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError((data as any)?.error || 'Registration failed');
      } else if (!data) {
        setError('Registration failed: empty response');
      } else {
        if ((data as any).keySalt) localStorage.setItem('keySalt', (data as any).keySalt);
        const authRes = await signIn('credentials', {
          email,
          password,
          redirect: false,
          callbackUrl: '/dashboard'
        });
        if (authRes?.error) {
          setError('Account created, but auto-login failed. Please log in manually.');
          router.push('/login');
          return;
        }
        router.push('/dashboard');
        router.refresh();
      }
    } catch (err: any) {
      console.error('Register request failed', err);
      setError('Registration failed: network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="login-orbit">
      <div className="login-orbit__backdrop" aria-hidden="true" />

      <div className="login-orbit__card">
        <div className="login-orbit__header">
          <p className="login-kicker">SecureShare — New Account</p>
          <h1>Create your vault</h1>
          <p className="login-subtitle">
            Register to access encrypted file storage with AI-powered threat scanning.
          </p>
        </div>

        {error && <div className="login-alert">{error}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          <input
            className="input login-input"
            name="name"
            placeholder="Full name"
            autoComplete="name"
            required
          />
          <input
            className="input login-input"
            name="email"
            placeholder="you@secure.local"
            type="email"
            autoComplete="email"
            required
          />
          <input
            className="input login-input"
            name="password"
            placeholder="Password"
            type="password"
            autoComplete="new-password"
            required
          />
          <input
            className="input login-input"
            name="confirm"
            placeholder="Confirm password"
            type="password"
            autoComplete="new-password"
            required
          />
          <button className="button login-cta" type="submit" disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <div className="login-links">
          <Link className="navlink" href="/login">Already have an account?</Link>
        </div>

        <div className="login-chips-row" aria-hidden="true">
          <span className="login-chip">E2E Encryption</span>
          <span className="login-chip">Zero Trust</span>
          <span className="login-chip">AI Threat Scan</span>
          <span className="login-chip">Secure Storage</span>
        </div>
      </div>
    </section>
  );
}
