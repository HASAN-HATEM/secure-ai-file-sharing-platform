import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { findUserById, createEmailVerificationToken } from '@/lib/users';
import { sendEmailVerificationEmail } from '@/lib/email';

export const runtime = 'nodejs';

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = Number(session.user.id);
  const user = await findUserById(userId);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (user.email_verified) {
    return NextResponse.json({ ok: true });
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const raw = await createEmailVerificationToken(userId);
  const verifyUrl = `${appUrl}/api/auth/verify-email?token=${raw}`;
  await sendEmailVerificationEmail(user.email, user.name, verifyUrl);

  return NextResponse.json({ ok: true });
}
