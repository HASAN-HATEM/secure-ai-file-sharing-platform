'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

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
  '/settings': 'Settings'
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
  const [user, setUser] = useState<{ name?: string; role?: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user || null);
        }
      } catch {
        // ignore fetch errors
      }
    })();
  }, []);

  return (
    <header className="page-topbar">
      <div className="breadcrumb">
        <span>Home</span>
        <span className="breadcrumb__sep">&gt;</span>
        <span className="breadcrumb__current">{title}</span>
      </div>
      <div className="user-pill">
        <div className="user-pill__avatar">{(user?.name || 'U').slice(0, 1).toUpperCase()}</div>
        <div>
          <div className="user-pill__name">{user?.name || 'User'}</div>
          <div className="user-pill__role">{user?.role || 'User'}</div>
        </div>
      </div>
    </header>
  );
}
