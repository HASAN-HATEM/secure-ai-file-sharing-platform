import './globals.css';
import type { Metadata } from 'next';
import AppShell from '@/components/AppShell';

export const metadata: Metadata = {
  title: 'Secure AI File Sharing Platform',
  description: 'Secure encrypted file sharing with AI scanning and classification'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="app-body">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
