'use client';

import { usePathname } from 'next/navigation';
import SideNav from './SideNav';
import TopBar from './TopBar';

const AUTH_ROUTES = ['/login', '/register', '/reset-password'];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuth = AUTH_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));

  if (isAuth) {
    return (
      <div className="auth-container">
        {children}
      </div>
    );
  }

  return (
    <div className="shell">
      <SideNav />
      <div className="main-area">
        <TopBar />
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}
