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
  const [user, setUser] = useState<{ name?: string; role?: string; avatarUrl?: string | null; emailVerified?: boolean } | null>(null);
  const [toastFiles, setToastFiles] = useState<Array<{ id: string; filename: string; ownerName?: string | null }>>([]);
  const [unseenSharedFiles, setUnseenSharedFiles] = useState<Array<{ id: string; filename: string; ownerName?: string | null }>>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
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
        const sharedFiles: Array<{ id: string; filename: string; ownerName?: string | null }> = (data.files || [])
          .filter((f: any) => !f.isOwner)
          .map((f: any) => ({ id: f.id, filename: f.filename, ownerName: f.ownerName }));
        const sharedIds = sharedFiles.map(f => f.id);
        const seen = getSeenIds();
        const newItems = sharedFiles.filter(f => !seen.has(f.id));

        if (pathname === '/shared') {
          markAsSeen(sharedIds);
          setToastFiles([]);
          setUnseenSharedFiles([]);
        } else {
          setUnseenSharedFiles(newItems);
          if (newItems.length > 0) {
            setToastFiles(newItems);
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
            toastTimerRef.current = setTimeout(() => setToastFiles([]), 7000);
          }
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

  const needsEmailVerification = user?.emailVerified === false;
  const notifCount = unseenSharedFiles.length + (needsEmailVerification ? 1 : 0);

  const handleBellClick = () => {
    setDropdownOpen((open) => !open);
  };

  const dismissSharedNotifications = () => {
    markAsSeen(unseenSharedFiles.map((f) => f.id));
    setUnseenSharedFiles([]);
    setToastFiles([]);
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
              {toastFiles[0].ownerName ? ` — from ${toastFiles[0].ownerName}` : ''}
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
          <div className="notif-dropdown-wrap">
            <button
              type="button"
              className="notif-bell"
              onClick={handleBellClick}
              title={notifCount > 0 ? `${notifCount} notification${notifCount !== 1 ? 's' : ''}` : 'Notifications'}
            >
              🔔
              {notifCount > 0 && <span className="notif-badge">{notifCount > 9 ? '9+' : notifCount}</span>}
            </button>
            {dropdownOpen && (
              <>
                <div className="notif-dropdown-backdrop" onClick={() => setDropdownOpen(false)} />
                <div className="notif-dropdown">
                  <div className="notif-dropdown__header">Notifications</div>
                  {unseenSharedFiles.length === 0 && !needsEmailVerification && (
                    <div className="notif-dropdown__empty">No new notifications</div>
                  )}
                  {unseenSharedFiles.length > 0 && (
                    <Link
                      href="/shared"
                      className="notif-dropdown__item"
                      onClick={() => { dismissSharedNotifications(); setDropdownOpen(false); }}
                    >
                      <span className="notif-dropdown__icon">🔗</span>
                      <div>
                        <div className="notif-dropdown__title">
                          {unseenSharedFiles.length === 1 ? 'New file shared with you' : `${unseenSharedFiles.length} new files shared with you`}
                        </div>
                        <div className="notif-dropdown__sub">
                          {unseenSharedFiles[0].filename}{unseenSharedFiles.length > 1 ? ` and ${unseenSharedFiles.length - 1} more` : ''}
                          {unseenSharedFiles[0].ownerName ? ` — from ${unseenSharedFiles[0].ownerName}` : ''}
                        </div>
                      </div>
                    </Link>
                  )}
                  {needsEmailVerification && (
                    <Link
                      href="/settings"
                      className="notif-dropdown__item"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <span className="notif-dropdown__icon">✉️</span>
                      <div>
                        <div className="notif-dropdown__title">Verify your email</div>
                        <div className="notif-dropdown__sub">Confirm your address to unlock full access.</div>
                      </div>
                    </Link>
                  )}
                </div>
              </>
            )}
          </div>
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
