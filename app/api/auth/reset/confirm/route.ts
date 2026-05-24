import { NextRequest, NextResponse } from 'next/server';
import { verifyAndConsumeToken } from '@/lib/password-reset';
import { hashPassword } from '@/lib/auth';
import { updateUserPassword } from '@/lib/users';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body.token ?? '').trim();
    const newPassword = String(body.newPassword ?? '');

    if (!token || !newPassword) {
      return NextResponse.json({ error: 'Token and new password are required' }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const result = await verifyAndConsumeToken(token);
    if (!result) {
      return NextResponse.json(
        { error: 'This link is invalid or has expired. Please request a new one.' },
        { status: 400 }
      );
    }

    const hash = await hashPassword(newPassword);
    await updateUserPassword(result.userId, hash);

    console.info('[reset/confirm] Password reset completed', { userId: result.userId });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[reset/confirm] Unexpected error', err);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
