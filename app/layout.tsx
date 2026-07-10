import './globals.css';
import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import AppShell from '@/components/AppShell';
import { authOptions } from '@/lib/auth-options';
import { getMaintenanceMode } from '@/lib/system-settings';

export const metadata: Metadata = {
  title: 'Secure AI File Sharing Platform',
  description: 'Secure encrypted file sharing with AI scanning and classification'
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions).catch(() => null);
  const role = (session?.user as any)?.role;

  let underMaintenance = false;
  if (session && role !== 'ADMIN') {
    underMaintenance = await getMaintenanceMode().catch(() => false);
  }

  return (
    <html lang="en">
      <body className="app-body">
        {underMaintenance ? (
          <div className="maintenance-screen">
            <div className="maintenance-screen__icon">🛠</div>
            <h1>Down for maintenance</h1>
            <p>SecureShare is temporarily unavailable while an administrator performs maintenance. Please check back shortly.</p>
          </div>
        ) : (
          <AppShell>{children}</AppShell>
        )}
      </body>
    </html>
  );
}
