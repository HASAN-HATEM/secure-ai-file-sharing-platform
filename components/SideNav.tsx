'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { signOut } from 'next-auth/react';

function SideAvatar({ user }: { user: { name?: string; avatarUrl?: string | null } | null }) {
  const [broken, setBroken] = useState(false);
  const initial = (user?.name || 'U').slice(0, 1).toUpperCase();
  if (user?.avatarUrl && !broken) {
    return (
      <img
        src={`${user.avatarUrl}?t=${Date.now()}`}
        alt="Avatar"
        onError={() => setBroken(true)}
        style={{ width: 38, height: 38, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }}
      />
    );
  }
  return <div className="user__avatar">{initial}</div>;
}

const sections = [
  {
    label: 'Menu',
    links: [
      { href: '/dashboard', label: 'Dashboard', icon: '🏠' },
      { href: '/upload', label: 'Upload Files', icon: '⤴' },
      { href: '/files', label: 'File Library', icon: '📁' },
      { href: '/shared', label: 'Shared with Me', icon: '🔗' },
      { href: '/trash', label: 'Trash', icon: '🗑' },
      { href: '/logs', label: 'My Activity', icon: '🧾' }
    ]
  },
  {
    label: 'Admin Control',
    links: [
      { href: '/admin', label: 'User Management', icon: '👤' },
      { href: '/analytics', label: 'Analytics', icon: '📊' },
      { href: '/security', label: 'Security Logs', icon: '🛡' },
      { href: '/system', label: 'System Settings', icon: '⚙' }
    ]
  },
  {
    label: 'Account',
    links: [
      { href: '/settings', label: 'Settings', icon: '🔧' }
    ]
  }
];

export default function SideNav() {
  const pathname = usePathname();
  const [user, setUser] = useState<{ name?: string; role?: string; avatarUrl?: string | null } | null>(null);

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
    <aside className="sidebar">
      <div className="sidebar__brand">
        <div className="brand__mark">S</div>
        <div>
          <div className="brand__name">SecureShare</div>
          <div className="brand__sub">Secure file sharing</div>
        </div>
      </div>

      <div className="sidebar__user">
        <SideAvatar user={user} />
        <div>
          <div className="user__name">{user?.name || 'User'}</div>
          <div className="user__role">{user?.role || 'User'}</div>
        </div>
      </div>

      {sections.map((section) => {
        if (section.label === 'Admin Control' && user?.role !== 'ADMIN') return null;
        return (
          <div className="nav-section" key={section.label}>
            <div className="nav-section__label">{section.label}</div>
            <div className="nav-section__links">
              {section.links.map((link) => {
                const active = pathname.startsWith(link.href);
                return (
                  <Link key={link.href} className={`nav-item${active ? ' active' : ''}`} href={link.href}>
                    <span className="nav-item__icon">{link.icon}</span>
                    <span className="nav-item__text">{link.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="sidebar__spacer" />
      <div className="sidebar__footer">
        <button type="button" className="signout-btn" onClick={() => signOut({ callbackUrl: '/login' })}>Sign out</button>
      </div>
    </aside>
  );
}
