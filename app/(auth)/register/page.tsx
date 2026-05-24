'use client';
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
      const res = await fetch('/api/auth/register', { method: 'POST', credentials: 'include', body: JSON.stringify({ name, email, password }), headers: { 'Content-Type': 'application/json' } });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError((data as any)?.error || 'Register failed');
      } else if (!data) {
        setError('Register failed: empty response');
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
      setError('Register failed: network error');
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="card" style={{ maxWidth: 420, margin: '0 auto' }}>
      <h2>Create account</h2>
      {error && <div style={{ color: 'salmon' }}>{error}</div>}
      <form onSubmit={handleSubmit}>
        <input className="input" name="name" placeholder="Name" required />
        <input className="input" name="email" placeholder="Email" type="email" required />
        <input className="input" name="password" placeholder="Password" type="password" required />
        <input className="input" name="confirm" placeholder="Confirm password" type="password" required />
        <button className="button" type="submit" disabled={loading}>{loading ? 'Creating account...' : 'Register'}</button>
      </form>
      <p>Already have an account? <a className="navlink" href="/login">Login</a></p>
    </div>
  );
}
