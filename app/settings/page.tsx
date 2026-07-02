'use client';

import { useEffect, useRef, useState } from 'react';

type User = {
  name?: string;
  email: string;
  role: string;
  created_at?: string;
  avatarUrl?: string | null;
};

type PackageDefinition = {
  key: string;
  name: string;
  priceCents: number;
  storageLimitBytes: number;
  features: string[];
  requiresUtmVerification?: boolean;
  badge?: string;
};

type PlanData = {
  currentKey: string;
  packages: PackageDefinition[];
  usedBytes: number;
  utmEmail: string | null;
  emailVerified: boolean;
};

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024)        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / 1024).toFixed(2)} KB`;
}

function formatPrice(priceCents: number) {
  return priceCents === 0 ? 'Free' : `$${(priceCents / 100).toFixed(0)}/mo`;
}

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

  const [profileMsg, setProfileMsg]   = useState('');
  const [profileErr, setProfileErr]   = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);

  const [pwMsg, setPwMsg]     = useState('');
  const [pwErr, setPwErr]     = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  const [avatarMsg, setAvatarMsg]   = useState('');
  const [avatarErr, setAvatarErr]   = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);

  const [plan, setPlan]             = useState<PlanData | null>(null);
  const [planMsg, setPlanMsg]       = useState('');
  const [planErr, setPlanErr]       = useState(false);
  const [planSwitching, setPlanSwitching] = useState('');

  const [utmInput, setUtmInput]     = useState('');
  const [utmLoading, setUtmLoading] = useState(false);
  const [utmMsg, setUtmMsg]         = useState('');
  const [utmErr, setUtmErr]         = useState(false);

  const [resendLoading, setResendLoading] = useState(false);
  const [resendMsg, setResendMsg]   = useState('');

  const loadUser = async () => {
    const res = await fetch('/api/auth/me', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      setUser(data.user);
    }
  };

  const loadPlan = async () => {
    const res = await fetch('/api/account/plan', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      setPlan(data);
    }
  };

  useEffect(() => {
    loadUser();
    loadPlan();
    const params = new URLSearchParams(window.location.search);
    const utmParam = params.get('utm');
    if (utmParam === 'verified') {
      setUtmMsg('Your UTM email has been verified! You\'ve been upgraded to the Student (Edu) plan.');
      setUtmErr(false);
    } else if (utmParam === 'invalid') {
      setUtmMsg('Verification link is invalid or has expired. Please try again.');
      setUtmErr(true);
    }
  }, []);

  const handlePlanSwitch = async (packageKey: string) => {
    setPlanMsg('');
    setPlanSwitching(packageKey);
    const res = await fetch('/api/account/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packageKey })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setPlanMsg('Plan updated successfully.');
      setPlanErr(false);
      await loadPlan();
    } else {
      setPlanMsg(data.error || 'Failed to switch plan.');
      setPlanErr(true);
    }
    setPlanSwitching('');
  };

  const handleUtmVerify = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setUtmMsg('');
    setUtmLoading(true);
    const res = await fetch('/api/account/utm-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ utmEmail: utmInput.trim() })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setUtmMsg(`Verification email sent to ${utmInput.trim()}. Check your inbox and click the link to unlock the Student plan.`);
      setUtmErr(false);
      setUtmInput('');
    } else {
      setUtmMsg(data.error || 'Failed to send verification email.');
      setUtmErr(true);
    }
    setUtmLoading(false);
  };

  const handleResendVerification = async () => {
    setResendMsg('');
    setResendLoading(true);
    const res = await fetch('/api/auth/resend-verification', { method: 'POST' });
    if (res.ok) {
      setResendMsg('Verification email sent. Check your inbox.');
    } else {
      setResendMsg('Failed to send. Please try again.');
    }
    setResendLoading(false);
  };

  const handleProfileSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setProfileMsg('');
    setProfileLoading(true);
    const form = new FormData(e.currentTarget);
    const name  = String(form.get('name')  || '').trim();
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
    const currentPassword  = String(form.get('currentPassword')  || '');
    const newPassword      = String(form.get('newPassword')      || '');
    const confirmPassword  = String(form.get('confirmPassword')  || '');
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

      {/* ── Email verification notice ────────────────────── */}
      {plan && !plan.emailVerified && (
        <div className="card" style={{ borderLeft: '4px solid var(--warning, #f59e0b)', padding: 16 }}>
          <div className="flex" style={{ gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <strong style={{ fontSize: 14 }}>Verify your email address</strong>
              <div className="muted" style={{ fontSize: 13 }}>
                Check your inbox for a verification link. Without it some features may be restricted.
              </div>
              {resendMsg && (
                <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>{resendMsg}</div>
              )}
            </div>
            <button
              type="button"
              className="button ghost"
              onClick={handleResendVerification}
              disabled={resendLoading}
              style={{ flexShrink: 0 }}
            >
              {resendLoading ? 'Sending…' : 'Resend verification email'}
            </button>
          </div>
        </div>
      )}

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
                <button type="button" className="button" onClick={handleAvatarUpload} disabled={avatarLoading}>
                  {avatarLoading ? 'Uploading…' : 'Save photo'}
                </button>
              )}
              {avatarPreview && (
                <button
                  type="button" className="button ghost"
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
          <div className="flex" style={{ gap: 8, alignItems: 'center' }}>
            {plan?.utmEmail && (
              <span className="status-tag" style={{ background: 'rgba(34,197,94,0.12)', color: '#16a34a', fontSize: 11 }}>
                UTM Verified ✓
              </span>
            )}
            {user && <span className="status-tag">{user.role}</span>}
          </div>
        </div>

        <StatusBanner message={profileMsg} isError={profileErr} />

        <form onSubmit={handleProfileSave}>
          <label style={{ display: 'block', fontWeight: 700, fontSize: 14, color: 'var(--muted)', marginBottom: 2 }}>
            Full name
          </label>
          <input className="input" name="name" defaultValue={user?.name || ''} key={user?.name} placeholder="Your full name" required />
          <label style={{ display: 'block', fontWeight: 700, fontSize: 14, color: 'var(--muted)', marginBottom: 2 }}>
            Email address
          </label>
          <input className="input" name="email" type="email" defaultValue={user?.email || ''} key={user?.email} placeholder="you@example.com" required />

          {plan?.utmEmail && (
            <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
              Verified UTM email: <strong>{plan.utmEmail}</strong>
            </div>
          )}

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

      {/* ── Plan & storage ───────────────────────────────── */}
      <div className="card">
        <div className="card__header">
          <div>
            <div className="card__title">Plan &amp; Storage</div>
            <div className="card__subtitle">Choose how much storage your account has.</div>
          </div>
        </div>

        <StatusBanner message={planMsg} isError={planErr} />
        <StatusBanner message={utmMsg}  isError={utmErr} />

        {plan && (() => {
          const current = plan.packages.find((p) => p.key === plan.currentKey) || plan.packages[0];
          const percent = Math.min(100, Math.round((plan.usedBytes / current.storageLimitBytes) * 100));
          return (
            <>
              <div className="progress" style={{ marginBottom: 8 }}>
                <div className="progress__fill" style={{ width: `${percent}%` }} />
              </div>
              <div className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
                {formatBytes(plan.usedBytes)} used of {formatBytes(current.storageLimitBytes)} ({current.name} plan)
              </div>

              <div className="flex" style={{ gap: 12, flexWrap: 'wrap' }}>
                {plan.packages.map((p) => {
                  const isCurrent = p.key === plan.currentKey;
                  const isEdu     = p.key === 'edu';
                  const hasUtm    = !!plan.utmEmail;

                  return (
                    <div key={p.key} className="card" style={{ flex: '1 1 220px', margin: 0, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                      {/* Card header */}
                      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border)' }}>
                        <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                          <strong style={{ fontSize: 15 }}>{p.name}</strong>
                          <div className="flex" style={{ gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            {isCurrent && <span className="status-tag" style={{ fontSize: 11 }}>Current</span>}
                            {p.badge && !isCurrent && (
                              <span className="status-tag" style={{ fontSize: 10 }}>{p.badge}</span>
                            )}
                            {isEdu && hasUtm && (
                              <span className="status-tag" style={{ background: 'rgba(34,197,94,0.12)', color: '#16a34a', fontSize: 10 }}>
                                UTM ✓
                              </span>
                            )}
                          </div>
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent)' }}>{formatPrice(p.priceCents)}</div>
                        <div className="muted" style={{ fontSize: 12 }}>{formatBytes(p.storageLimitBytes)} storage</div>
                      </div>

                      {/* Features list */}
                      <div style={{ padding: '10px 16px', flex: 1 }}>
                        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                          {p.features.map((f) => (
                            <li key={f} style={{ fontSize: 12, color: 'var(--ink)', padding: '3px 0', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                              <span style={{ color: 'var(--accent)', fontWeight: 800, flexShrink: 0 }}>✓</span>
                              {f}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* CTA */}
                      <div style={{ padding: '8px 16px 14px' }}>
                        {!isCurrent && (!isEdu || hasUtm) && (
                          <button
                            type="button"
                            className="button ghost"
                            style={{ width: '100%' }}
                            disabled={planSwitching === p.key}
                            onClick={() => handlePlanSwitch(p.key)}
                          >
                            {planSwitching === p.key ? 'Switching…' : 'Switch to this plan'}
                          </button>
                        )}

                        {isEdu && !hasUtm && !utmMsg && (
                          <form onSubmit={handleUtmVerify}>
                            <input
                              className="input"
                              type="email"
                              placeholder="you@graduate.utm.my"
                              value={utmInput}
                              onChange={(e) => setUtmInput(e.target.value)}
                              style={{ marginBottom: 6, fontSize: 12 }}
                              required
                            />
                            <button type="submit" className="button" style={{ width: '100%' }} disabled={utmLoading}>
                              {utmLoading ? 'Sending…' : 'Verify & Unlock'}
                            </button>
                          </form>
                        )}

                        {isEdu && !hasUtm && utmMsg && !utmErr && (
                          <div style={{ fontSize: 12, color: '#16a34a' }}>
                            Check your UTM inbox for the verification link.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          );
        })()}
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
