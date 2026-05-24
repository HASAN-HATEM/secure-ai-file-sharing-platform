'use client';

import { useEffect, useRef, useState } from 'react';

type User = {
  name?: string;
  email: string;
  role: string;
  created_at?: string;
  avatarUrl?: string | null;
};

function AvatarCircle({ user, size = 72 }: { user: User | null; size?: number }) {
  const [broken, setBroken] = useState(false);
  const initial = (user?.name || user?.email || 'U').slice(0, 1).toUpperCase();

  if (user?.avatarUrl && !broken) {
    return (
      <img
        src={`${user.avatarUrl}?t=${Date.now()}`}
        alt="Profile"
        onError={() => setBroken(true)}
        style={{
          width: size, height: size, borderRadius: '50%',
          objectFit: 'cover', border: '3px solid var(--border)'
        }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'var(--accent)', color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.4, fontWeight: 800, flexShrink: 0
    }}>
      {initial}
    </div>
  );
}

function StatusBanner({ message, isError }: { message: string; isError: boolean }) {
  if (!message) return null;
  return (
    <div className={`status-tag${isError ? ' tag-danger' : ''}`} style={{ marginBottom: 12 }}>
      {message}
    </div>
  );
}

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [profileMsg, setProfileMsg] = useState('');
  const [profileErr, setProfileErr] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);

  const [pwMsg, setPwMsg] = useState('');
  const [pwErr, setPwErr] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  const [avatarMsg, setAvatarMsg] = useState('');
  const [avatarErr, setAvatarErr] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);

  const loadUser = async () => {
    const res = await fetch('/api/auth/me', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      setUser(data.user);
    }
  };

  useEffect(() => { loadUser(); }, []);

  const handleProfileSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setProfileMsg('');
    setProfileLoading(true);
    const form = new FormData(e.currentTarget);
    const name = String(form.get('name') || '').trim();
    const email = String(form.get('email') || '').trim();
    const res = await fetch('/api/auth/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setProfileMsg('Profile updated successfully.');
      setProfileErr(false);
      await loadUser();
    } else {
      setProfileMsg(data.error || 'Failed to update profile.');
      setProfileErr(true);
    }
    setProfileLoading(false);
  };

  const handlePasswordSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPwMsg('');
    setPwLoading(true);
    const form = new FormData(e.currentTarget);
    const currentPassword = String(form.get('currentPassword') || '');
    const newPassword = String(form.get('newPassword') || '');
    const confirmPassword = String(form.get('confirmPassword') || '');
    if (newPassword !== confirmPassword) {
      setPwMsg('New passwords do not match.');
      setPwErr(true);
      setPwLoading(false);
      return;
    }
    const res = await fetch('/api/auth/me/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setPwMsg('Password changed successfully.');
      setPwErr(false);
      (e.target as HTMLFormElement).reset();
    } else {
      setPwMsg(data.error || 'Failed to change password.');
      setPwErr(true);
    }
    setPwLoading(false);
  };

  const handleAvatarPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarPreview(URL.createObjectURL(file));
    setAvatarMsg('');
  };

  const handleAvatarUpload = async () => {
    const file = avatarInputRef.current?.files?.[0];
    if (!file) return;
    setAvatarLoading(true);
    setAvatarMsg('');
    const form = new FormData();
    form.append('avatar', file);
    const res = await fetch('/api/auth/me/avatar', { method: 'POST', body: form });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setAvatarMsg('Profile picture updated.');
      setAvatarErr(false);
      setAvatarPreview(null);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
      await loadUser();
    } else {
      setAvatarMsg(data.error || 'Upload failed.');
      setAvatarErr(true);
    }
    setAvatarLoading(false);
  };

  return (
    <div className="page">
      <div className="page-header">
        <p className="eyebrow">Account</p>
        <h1 className="page-title">Settings</h1>
        <p className="muted">Manage your profile, security, and preferences.</p>
      </div>

      {/* ── Profile picture ─────────────────────────────── */}
      <div className="card">
        <div className="card__header">
          <div>
            <div className="card__title">Profile Picture</div>
            <div className="card__subtitle">JPG, PNG, WebP or GIF · max 2 MB</div>
          </div>
        </div>

        <StatusBanner message={avatarMsg} isError={avatarErr} />

        <div className="flex" style={{ gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            {avatarPreview
              ? <img src={avatarPreview} alt="Preview" style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--accent)' }} />
              : <AvatarCircle user={user} size={72} />
            }
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              style={{
                position: 'absolute', bottom: -2, right: -2,
                width: 24, height: 24, borderRadius: '50%',
                background: 'var(--accent)', color: '#fff',
                border: '2px solid #fff', cursor: 'pointer',
                fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
              title="Change photo"
            >+</button>
          </div>

          <div style={{ flex: 1, minWidth: 200 }}>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              style={{ display: 'none' }}
              onChange={handleAvatarPick}
            />
            <div className="button-row">
              <button type="button" className="button" onClick={() => avatarInputRef.current?.click()}>
                Choose photo
              </button>
              {avatarPreview && (
                <button
                  type="button"
                  className="button"
                  onClick={handleAvatarUpload}
                  disabled={avatarLoading}
                >
                  {avatarLoading ? 'Uploading…' : 'Save photo'}
                </button>
              )}
              {avatarPreview && (
                <button
                  type="button"
                  className="button ghost"
                  onClick={() => { setAvatarPreview(null); if (avatarInputRef.current) avatarInputRef.current.value = ''; }}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Profile information ──────────────────────────── */}
      <div className="card">
        <div className="card__header">
          <div>
            <div className="card__title">Profile Information</div>
            <div className="card__subtitle">Update your display name and email address.</div>
          </div>
          {user && (
            <span className="status-tag">
              {user.role}
            </span>
          )}
        </div>

        <StatusBanner message={profileMsg} isError={profileErr} />

        <form onSubmit={handleProfileSave}>
          <label style={{ display: 'block', fontWeight: 700, fontSize: 14, color: 'var(--muted)', marginBottom: 2 }}>
            Full name
          </label>
          <input
            className="input"
            name="name"
            defaultValue={user?.name || ''}
            key={user?.name}
            placeholder="Your full name"
            required
          />
          <label style={{ display: 'block', fontWeight: 700, fontSize: 14, color: 'var(--muted)', marginBottom: 2 }}>
            Email address
          </label>
          <input
            className="input"
            name="email"
            type="email"
            defaultValue={user?.email || ''}
            key={user?.email}
            placeholder="you@example.com"
            required
          />

          {user?.created_at && (
            <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
              Member since {new Date(user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          )}

          <button className="button" type="submit" disabled={profileLoading}>
            {profileLoading ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </div>

      {/* ── Change password ──────────────────────────────── */}
      <div className="card">
        <div className="card__header">
          <div>
            <div className="card__title">Change Password</div>
            <div className="card__subtitle">Use a strong password of at least 8 characters.</div>
          </div>
        </div>

        <StatusBanner message={pwMsg} isError={pwErr} />

        <form onSubmit={handlePasswordSave}>
          <label style={{ display: 'block', fontWeight: 700, fontSize: 14, color: 'var(--muted)', marginBottom: 2 }}>
            Current password
          </label>
          <input className="input" name="currentPassword" type="password" placeholder="Current password" autoComplete="current-password" required />

          <label style={{ display: 'block', fontWeight: 700, fontSize: 14, color: 'var(--muted)', marginBottom: 2 }}>
            New password
          </label>
          <input className="input" name="newPassword" type="password" placeholder="New password (min 8 chars)" autoComplete="new-password" required />

          <label style={{ display: 'block', fontWeight: 700, fontSize: 14, color: 'var(--muted)', marginBottom: 2 }}>
            Confirm new password
          </label>
          <input className="input" name="confirmPassword" type="password" placeholder="Confirm new password" autoComplete="new-password" required />

          <button className="button" type="submit" disabled={pwLoading}>
            {pwLoading ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>

      {/* ── Notification preferences ─────────────────────── */}
      <div className="card">
        <div className="card__header">
          <div>
            <div className="card__title">Notification Preferences</div>
            <div className="card__subtitle">Control which events you are notified about.</div>
          </div>
        </div>
        <div className="toggle-row">
          <div className="toggle-label">
            <strong>File Upload Notifications</strong>
            <span className="muted">Get notified when file uploads complete</span>
          </div>
          <button className="toggle active" aria-label="toggle upload alerts" />
        </div>
        <div className="toggle-row">
          <div className="toggle-label">
            <strong>Login Notifications</strong>
            <span className="muted">Get notified when someone logs into your account</span>
          </div>
          <button className="toggle" aria-label="toggle login alerts" />
        </div>
        <div className="toggle-row">
          <div className="toggle-label">
            <strong>Threat Alerts</strong>
            <span className="muted">Get notified when a malicious file is blocked</span>
          </div>
          <button className="toggle active" aria-label="toggle threat alerts" />
        </div>
      </div>
    </div>
  );
}
