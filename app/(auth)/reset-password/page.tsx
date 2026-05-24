'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

function ResetPageInner() {
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get('token') ?? '';

  const [stage, setStage] = useState<'request' | 'reset' | 'done'>(
    tokenFromUrl ? 'reset' : 'request'
  );
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);

  const requestReset = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    const email = String(new FormData(e.currentTarget).get('email') ?? '');
    try {
      await fetch('/api/auth/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      // Same message whether account exists or not — prevents enumeration
      setMessage('If an account with that email exists, a reset link has been sent. Check your inbox (and spam folder).');
      setIsError(false);
      setStage('done');
    } catch {
      setMessage('Something went wrong. Please try again.');
      setIsError(true);
    } finally {
      setLoading(false);
    }
  };

  const confirmReset = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    const form = new FormData(e.currentTarget);
    const newPassword = String(form.get('newPassword') ?? '');
    const confirm = String(form.get('confirm') ?? '');

    if (newPassword !== confirm) {
      setMessage('Passwords do not match.');
      setIsError(true);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/reset/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenFromUrl, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMessage('Password updated — you can now log in with your new password.');
        setIsError(false);
        setStage('done');
      } else {
        setMessage(data.error ?? 'Could not reset password.');
        setIsError(true);
      }
    } catch {
      setMessage('Something went wrong. Please try again.');
      setIsError(true);
    } finally {
      setLoading(false);
    }
  };

  const subtitle: Record<typeof stage, string> = {
    request: "Enter your email and we'll send you a secure link to reset your password.",
    reset:   'Create a new password for your account.',
    done:    tokenFromUrl ? 'Your password has been updated successfully.' : '',
  };

  return (
    <section className="login-orbit">
      <div className="login-orbit__backdrop" aria-hidden="true" />

      <div className="login-orbit__card">
        <div className="login-orbit__header">
          <p className="login-kicker">SecureShare — Account Recovery</p>
          <h1>
            {stage === 'request' && 'Forgot your password?'}
            {stage === 'reset'   && 'Choose a new password'}
            {stage === 'done'    && 'Check your inbox'}
          </h1>
          {subtitle[stage] && (
            <p className="login-subtitle">{subtitle[stage]}</p>
          )}
        </div>

        {message && (
          <div className={`login-alert${isError ? '' : ' login-alert--success'}`}>
            {message}
          </div>
        )}

        {stage === 'request' && (
          <form onSubmit={requestReset} className="login-form">
            <input
              className="input login-input"
              name="email"
              placeholder="you@example.com"
              type="email"
              autoComplete="email"
              required
              autoFocus
            />
            <button className="button login-cta" type="submit" disabled={loading}>
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}

        {stage === 'reset' && (
          <form onSubmit={confirmReset} className="login-form">
            <input
              className="input login-input"
              name="newPassword"
              placeholder="New password (min. 8 characters)"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              autoFocus
            />
            <input
              className="input login-input"
              name="confirm"
              placeholder="Confirm new password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
            />
            <button className="button login-cta" type="submit" disabled={loading}>
              {loading ? 'Updating…' : 'Update password'}
            </button>
          </form>
        )}

        <div className="login-links">
          <Link className="navlink" href="/login">Back to login</Link>
          {stage === 'done' && (
            <Link className="navlink" href="/login">Go to login →</Link>
          )}
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

export default function ResetPage() {
  return (
    <Suspense>
      <ResetPageInner />
    </Suspense>
  );
}
