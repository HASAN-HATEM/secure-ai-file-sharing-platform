'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

export default function DashboardPage() {
  const [files, setFiles] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const res = await fetch('/api/files/list');
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files || []);
        setActivity(data.activity || []);
      }
    })();
  }, []);
  const totalBytes = useMemo(() => files.reduce((s, f) => s + Number(f.size_bytes || 0), 0), [files]);
  const storageLimitBytes = 100 * 1024 * 1024;
  const storagePercent = Math.min(100, Math.round((totalBytes / storageLimitBytes) * 100));
  const storageUsedMb = (totalBytes / 1024 / 1024) || 0;
  const remainingMb = Math.max(0, storageLimitBytes / 1024 / 1024 - storageUsedMb);
  const latestActivity = activity?.[0];

  const recentFiles = useMemo(() => {
    return [...files]
      .sort((a, b) => new Date(b.created_at || b.timestamp || 0).getTime() - new Date(a.created_at || a.timestamp || 0).getTime())
      .slice(0, 4);
  }, [files]);

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
        <h1 className="page-title">Welcome back! Here&apos;s an overview of your files.</h1>
      </div>

      <div className="stat-grid">
        <div className="card stat-card">
          <div className="stat-card__icon">F</div>
          <div className="stat-card__label">Total Files</div>
          <div className="stat-card__value">{files.length}</div>
          <div className="stat-card__hint">Files stored safely</div>
        </div>
        <div className="card stat-card">
          <div className="stat-card__icon">S</div>
          <div className="stat-card__label">Storage Used</div>
          <div className="stat-card__value">{storageUsedMb.toFixed(2)} MB</div>
          <div className="stat-card__hint">of 100 MB limit</div>
        </div>
        <div className="card stat-card">
          <div className="stat-card__icon">A</div>
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
            <span>{remainingMb.toFixed(2)} MB remaining of 100 MB</span>
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
                <div className="recent-item__icon">F</div>
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
