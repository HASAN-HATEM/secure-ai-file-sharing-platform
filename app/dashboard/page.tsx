'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

function mimeIcon(mime: string): string {
  if (!mime) return '📄';
  if (mime.startsWith('image/')) return '🖼';
  if (mime.startsWith('video/')) return '🎬';
  if (mime.startsWith('audio/')) return '🎵';
  if (mime === 'application/pdf') return '📕';
  if (mime.includes('zip') || mime.includes('rar') || mime.includes('tar') || mime.includes('gzip')) return '🗜';
  if (mime.includes('word') || mime.includes('document')) return '📝';
  if (mime.includes('sheet') || mime.includes('excel') || mime.includes('csv')) return '📊';
  if (mime.startsWith('text/')) return '📄';
  return '📁';
}

const QUICK_ACTIONS = [
  { href: '/upload', label: 'Upload Files', icon: '⤴' },
  { href: '/files', label: 'My Library', icon: '📁' },
  { href: '/shared', label: 'Shared with Me', icon: '🔗' },
  { href: '/logs', label: 'Activity Log', icon: '🧾' },
];

function IconFiles() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function IconStorage() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

export default function DashboardPage() {
  const [files, setFiles] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [user, setUser] = useState<{ name?: string; emailVerified?: boolean } | null>(null);
  const [verifiedParam, setVerifiedParam] = useState<string | null>(null);
  const [plan, setPlan] = useState<{ currentKey: string; packages: { key: string; name: string; storageLimitBytes: number }[]; usedBytes: number } | null>(null);

  useEffect(() => {
    (async () => {
      const [filesRes, userRes, planRes] = await Promise.all([
        fetch('/api/files/list'),
        fetch('/api/auth/me', { cache: 'no-store' }),
        fetch('/api/account/plan', { cache: 'no-store' }),
      ]);
      if (filesRes.ok) {
        const data = await filesRes.json();
        setFiles(data.files || []);
        setActivity(data.activity || []);
      }
      if (userRes.ok) {
        const data = await userRes.json();
        setUser(data.user ? { name: data.user.name, emailVerified: data.user.emailVerified } : null);
      }
      setVerifiedParam(new URLSearchParams(window.location.search).get('verified'));
      if (planRes.ok) {
        const data = await planRes.json();
        setPlan(data);
      }
    })();
  }, []);

  const currentPackage = useMemo(() => {
    if (!plan) return null;
    return plan.packages.find((p) => p.key === plan.currentKey) || plan.packages[0] || null;
  }, [plan]);

  const totalBytes = plan?.usedBytes ?? 0;
  const storageLimitBytes = currentPackage?.storageLimitBytes ?? 1024 * 1024 * 1024;
  const storageLimitLabel = storageLimitBytes >= 1024 * 1024 * 1024
    ? `${(storageLimitBytes / 1024 / 1024 / 1024).toFixed(0)} GB`
    : `${(storageLimitBytes / 1024 / 1024).toFixed(0)} MB`;
  const storagePercent = Math.min(100, Math.round((totalBytes / storageLimitBytes) * 100));
  const storageUsedMb = (totalBytes / 1024 / 1024) || 0;
  const remainingMb = Math.max(0, storageLimitBytes / 1024 / 1024 - storageUsedMb);
  const latestActivity = activity?.[0];

  const recentFiles = useMemo(() => {
    return [...files]
      .sort((a, b) => new Date(b.created_at || b.timestamp || 0).getTime() - new Date(a.created_at || a.timestamp || 0).getTime())
      .slice(0, 4);
  }, [files]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const firstName = user?.name?.split(' ')[0];

  const formatAgo = (value: string | number | Date | undefined) => {
    if (!value) return 'Just now';
    const now = Date.now();
    const ts = new Date(value).getTime();
    if (Number.isNaN(ts)) return 'Just now';
    const diffMinutes = Math.max(1, Math.floor((now - ts) / 60000));
    if (diffMinutes < 60) return `${diffMinutes} min${diffMinutes === 1 ? '' : 's'} ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} hr${diffHours === 1 ? '' : 's'} ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  };

  return (
    <div className="page">
      <div className="page-header">
        <p className="eyebrow">Dashboard</p>
        <h1 className="page-title">
          {greeting}{firstName ? `, ${firstName}` : ''}.
        </h1>
        <p className="muted">Here&apos;s an overview of your secure vault.</p>
      </div>

      {verifiedParam === '1' && (
        <div className="status-tag" style={{ marginBottom: 16 }}>
          Email verified — your account is fully activated.
        </div>
      )}
      {verifiedParam === 'invalid' && (
        <div className="status-tag tag-danger" style={{ marginBottom: 16 }}>
          Verification link invalid or expired. Go to Settings to resend.
        </div>
      )}
      {user && user.emailVerified === false && verifiedParam !== '1' && (
        <div className="card" style={{ borderLeft: '4px solid var(--warning, #f59e0b)', padding: 14, marginBottom: 16 }}>
          <strong style={{ fontSize: 14 }}>Verify your email</strong>
          <span className="muted" style={{ fontSize: 13, marginLeft: 8 }}>
            Check your inbox for a verification link, or go to{' '}
            <a href="/settings" style={{ color: 'var(--accent)' }}>Settings</a> to resend it.
          </span>
        </div>
      )}

      <div className="quick-actions">
        {QUICK_ACTIONS.map((a) => (
          <Link key={a.href} className="quick-action" href={a.href}>
            <span className="quick-action__icon">{a.icon}</span>
            {a.label}
          </Link>
        ))}
      </div>

      <div className="stat-grid">
        <div className="card stat-card">
          <div className="stat-card__icon"><IconFiles /></div>
          <div className="stat-card__label">Total Files</div>
          <div className="stat-card__value">{files.length}</div>
          <div className="stat-card__hint">Files stored safely</div>
        </div>
        <div className="card stat-card">
          <div className="stat-card__icon"><IconStorage /></div>
          <div className="stat-card__label">Storage Used</div>
          <div className="stat-card__value">{storageUsedMb.toFixed(2)} MB</div>
          <div className="stat-card__hint">of {storageLimitLabel} limit{currentPackage ? ` (${currentPackage.name})` : ''}</div>
        </div>
        <div className="card stat-card">
          <div className="stat-card__icon"><IconClock /></div>
          <div className="stat-card__label">Recent Activity</div>
          <div className="stat-card__value">{latestActivity ? formatAgo(latestActivity.timestamp) : 'No activity'}</div>
          <div className="stat-card__hint">Latest audit event</div>
        </div>
      </div>

      <div className="panel-grid">
        <div className="card usage-card">
          <div className="card__header">
            <div>
              <div className="card__title">Storage Usage</div>
              <div className="card__subtitle">Used</div>
            </div>
            <div className="usage__value">{(totalBytes / 1024).toFixed(2)} KB</div>
          </div>
          <div className="progress">
            <div className="progress__fill" style={{ width: `${storagePercent}%` }} />
          </div>
          <div className="usage__meta">
            <span>{storageUsedMb.toFixed(2)} MB used</span>
            <span>{remainingMb.toFixed(2)} MB remaining of {storageLimitLabel}</span>
          </div>
          <div className="button-row">
            <Link className="button" href="/upload">Upload Files</Link>
            <Link className="button ghost" href="/files">View Library</Link>
          </div>
        </div>

        <div className="card recent-card">
          <div className="card__header">
            <div className="card__title">Recent Files</div>
            <Link className="link-muted" href="/files">View All</Link>
          </div>
          <div className="recent-list">
            {recentFiles.length === 0 && <p className="muted">No recent files yet.</p>}
            {recentFiles.map((file) => (
              <div key={file.id} className="recent-item">
                <div className="recent-item__icon">{mimeIcon(file.mime_type)}</div>
                <div>
                  <div className="recent-item__name">{file.filename}</div>
                  <div className="recent-item__meta">{file.mime_type} • {(file.size_bytes / 1024).toFixed(2)} KB</div>
                </div>
                <div className="recent-item__time">{formatAgo(file.created_at)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
