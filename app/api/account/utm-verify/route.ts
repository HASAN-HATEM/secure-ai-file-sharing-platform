import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import {
  findUserById,
  isUtmEmail,
  requestUtmVerification,
  confirmUtmVerification,
} from '@/lib/users';
import { sendUtmVerificationEmail } from '@/lib/email';
import { logAudit } from '@/lib/audit';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = Number(session.user.id);
  const body = await req.json().catch(() => ({}));
  const utmEmail = String(body.utmEmail ?? '').toLowerCase().trim();

  if (!utmEmail || !isUtmEmail(utmEmail)) {
    return NextResponse.json(
      { error: 'Must be a valid @utm.my or @graduate.utm.my email address' },
      { status: 400 }
    );
  }

  const user = await findUserById(userId);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const raw = await requestUtmVerification(userId, utmEmail);
  const verifyUrl = `${appUrl}/api/account/utm-verify?token=${raw}`;

  await sendUtmVerificationEmail(utmEmail, user.name, verifyUrl);
  await logAudit(userId, 'UTM_VERIFY_REQUEST', 'user', userId, { utmEmail }).catch(() => null);

  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const token  = req.nextUrl.searchParams.get('token') ?? '';
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');

  if (!token) {
    return NextResponse.redirect(`${appUrl}/settings?utm=invalid`);
  }

  const userId = await confirmUtmVerification(token).catch(() => null);
  if (!userId) {
    return NextResponse.redirect(`${appUrl}/settings?utm=invalid`);
  }

  await logAudit(userId, 'UTM_VERIFIED', 'user', userId, {}).catch(() => null);
  return NextResponse.redirect(`${appUrl}/settings?utm=verified`);
}
