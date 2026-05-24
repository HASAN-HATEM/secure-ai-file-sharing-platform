'use client';
import { useState } from 'react';

export default function ResetPage() {
  const [message, setMessage] = useState('');
  const [stage, setStage] = useState<'request' | 'reset'>('request');
  const [email, setEmail] = useState('');

  const requestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('A demo reset token has been issued: demo-reset');
    setStage('reset');
  };

  const doReset = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const newPassword = form.get('newPassword');
    const token = form.get('token');
    const res = await fetch('/api/auth/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, newPassword, token }) });
    const data = await res.json();
    if (res.ok && data.ok) setMessage('Password updated. You can log in now.');
    else setMessage(data.message || data.error || 'Could not reset');
  };

  return (
    <div className="card" style={{ maxWidth: 420, margin: '0 auto' }}>
      <h2>Reset password</h2>
      <p style={{ color: 'orange' }}>{message}</p>
      {stage === 'request' && (
        <form onSubmit={requestReset}>
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} name="email" placeholder="Email" required />
          <button className="button" type="submit">Send reset link</button>
        </form>
      )}
      {stage === 'reset' && (
        <form onSubmit={doReset}>
          <input className="input" value={email} readOnly name="email" />
          <input className="input" name="token" placeholder="Token (demo-reset)" required />
          <input className="input" name="newPassword" placeholder="New password" type="password" required />
          <button className="button" type="submit">Update password</button>
        </form>
      )}
    </div>
  );
}
