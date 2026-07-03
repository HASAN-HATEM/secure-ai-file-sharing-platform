import { NextRequest, NextResponse } from 'next/server';
import { findUserByEmail } from '@/lib/users';
import { isRateLimited, createPasswordResetToken } from '@/lib/password-reset';
import { sendPasswordResetEmail } from '@/lib/email';

function getIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    '127.0.0.1'
  );
}

// Always return the same shape regardless of outcome — prevents email enumeration
const OK = () => NextResponse.json({ ok: true });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email ?? '').toLowerCase().trim();
    if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });

    const ip = getIp(req);

    if (await isRateLimited(ip)) {
      console.warn('[reset] Rate limit hit', { ip });
      return OK();
    }

    const user = await findUserByEmail(email);

    if (user) {
      const appUrl = (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
      const rawToken = await createPasswordResetToken(user.id, ip);
      const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;
      await sendPasswordResetEmail(user.email, user.name, resetUrl);
    }

    return OK();
  } catch (err) {
    console.error('[reset] Unexpected error', err);
    return OK();
  }
}
