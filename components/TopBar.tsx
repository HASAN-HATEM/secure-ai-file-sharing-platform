'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

const SEEN_KEY = 'secshare_seen_shared';

function getSeenIds(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}

function markAsSeen(ids: string[]) {
  try {
    const seen = getSeenIds();
    ids.forEach(id => seen.add(id));
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
  } catch {}
}

function TopAvatar({ user }: { user: { name?: string; avatarUrl?: string | null } | null }) {
  const [broken, setBroken] = useState(false);
  const initial = (user?.name || 'U').slice(0, 1).toUpperCase();
  if (user?.avatarUrl && !broken) {
    return (
      <img
        src={`${user.avatarUrl}?t=${Date.now()}`}
        alt="Avatar"
        onError={() => setBroken(true)}
        style={{ width: 34, height: 34, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }}
      />
    );
  }
  return <div className="user-pill__avatar">{initial}</div>;
}

const LABELS: Record<string, string> = {
  '/': 'Dashboard',
  '/dashboard': 'Dashboard',
  '/upload': 'Upload Files',
  '/files': 'File Library',
  '/admin': 'Admin',
  '/shared': 'Shared with Me',
  '/analytics': 'Analytics',
  '/security': 'Security Logs',
  '/system': 'System Settings',
  '/settings': 'Settings',
  '/trash': 'Trash'
};

function formatTitle(pathname: string) {
  if (!pathname || pathname === '/') return 'Dashboard';
  const segments = pathname.split('/').filter(Boolean);
  const base = `/${segments[0] || ''}`;
  if (LABELS[base]) return LABELS[base];
  return segments[segments.length - 1]
    ?.replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase()) || 'Dashboard';
}

export default function TopBar() {
  const pathname = usePathname();
  const title = formatTitle(pathname);
  const [user, setUser] = useState<{ name?: string; role?: string; avatarUrl?: string | null } | null>(null);
  const [newCount, setNewCount] = useState(0);
  const [toastFiles, setToastFiles] = useState<Array<{ id: string; filename: string }>>([]);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user || null);
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/api/files', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        const sharedFiles: Array<{ id: string; filename: string }> = (data.files || [])
          .filter((f: any) => !f.isOwner);
        const sharedIds = sharedFiles.map(f => f.id);
        const seen = getSeenIds();
        const newItems = sharedFiles.filter(f => !seen.has(f.id));

        if (newItems.length > 0 && pathname !== '/shared') {
          setNewCount(newItems.length);
          setToastFiles(newItems);
          if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
          toastTimerRef.current = setTimeout(() => setToastFiles([]), 7000);
        } else if (pathname === '/shared') {
          markAsSeen(sharedIds);
          setNewCount(0);
          setToastFiles([]);
        } else {
          setNewCount(sharedIds.filter(id => !seen.has(id)).length);
        }
      } catch {}
    };

    check();
    const interval = setInterval(check, 30_000);
    return () => {
      clearInterval(interval);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const handleBellClick = () => {
    fetch('/api/files', { cache: 'no-store' })
      .then(r => r.json())
      .then(data => {
        const ids = (data.files || []).filter((f: any) => !f.isOwner).map((f: any) => f.id as string);
        markAsSeen(ids);
        setNewCount(0);
        setToastFiles([]);
      })
      .catch(() => {});
  };

  return (
    <>
      {toastFiles.length > 0 && pathname !== '/shared' && (
        <div className="notif-toast">
          <div className="notif-toast__icon">🔗</div>
          <div className="notif-toast__content">
            <div className="notif-toast__title">
              {toastFiles.length === 1 ? 'New file shared with you' : `${toastFiles.length} new files shared with you`}
            </div>
            <div className="notif-toast__sub">
              {toastFiles[0].filename}{toastFiles.length > 1 ? ` and ${toastFiles.length - 1} more` : ''}
            </div>
          </div>
          <button className="notif-toast__close" type="button" onClick={() => setToastFiles([])}>✕</button>
        </div>
      )}

      <header className="page-topbar">
        <div className="breadcrumb">
          <span>Home</span>
          <span className="breadcrumb__sep">&gt;</span>
          <span className="breadcrumb__current">{title}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link
            href="/shared"
            className="notif-bell"
            onClick={handleBellClick}
            title={newCount > 0 ? `${newCount} new shared file${newCount !== 1 ? 's' : ''}` : 'Shared with me'}
          >
            🔔
            {newCount > 0 && <span className="notif-badge">{newCount > 9 ? '9+' : newCount}</span>}
          </Link>
          <div className="user-pill">
            <TopAvatar user={user} />
            <div>
              <div className="user-pill__name">{user?.name || 'User'}</div>
              <div className="user-pill__role">{user?.role || 'User'}</div>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
