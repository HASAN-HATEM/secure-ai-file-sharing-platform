import { NextRequest, NextResponse } from 'next/server';
import { findUserByEmail, createUser, createEmailVerificationToken } from '@/lib/users';
import { sendEmailVerificationEmail } from '@/lib/email';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Server misconfigured: DATABASE_URL not set' }, { status: 500 });
    }
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    const name     = typeof body.name     === 'string' ? body.name                    : '';
    const email    = typeof body.email    === 'string' ? body.email.toLowerCase()     : '';
    const password = body.password;
    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }
    const existing = await findUserByEmail(email);
    if (existing) {
      return NextResponse.json({ error: 'Email in use' }, { status: 400 });
    }
    const user = await createUser(name, email, password, 'USER', false);

    const appUrl = (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
    const raw = await createEmailVerificationToken(user.id);
    const verifyUrl = `${appUrl}/api/auth/verify-email?token=${raw}`;
    await sendEmailVerificationEmail(user.email, user.name, verifyUrl).catch((err) =>
      console.error('[register] Failed to send verification email', err)
    );

    return NextResponse.json({
      id:       user.id,
      email:    user.email,
      name:     user.name,
      role:     user.role,
      keySalt:  Buffer.from(user.key_salt).toString('base64')
    });
  } catch (err: any) {
    console.error('Register error', err);
    const message =
      err?.code === 'ECONNREFUSED' || err?.code === 'ENOTFOUND'
        ? 'Database unavailable: check DATABASE_URL and Postgres'
        : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
