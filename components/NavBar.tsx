'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function NavBar() {
  const path = usePathname();
  const links = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/upload', label: 'Upload' },
    { href: '/files', label: 'Files' },
    { href: '/admin', label: 'Admin' }
  ];
  return (
    <div className="navbar">
      {links.map((l) => (
        <Link key={l.href} className="navlink" style={{ opacity: path.startsWith(l.href) ? 1 : 0.7 }} href={l.href}>
          {l.label}
        </Link>
      ))}
      <form action="/api/auth/logout" method="post" style={{ marginLeft: 'auto' }}>
        <button className="button" type="submit">Logout</button>
      </form>
    </div>
  );
}
