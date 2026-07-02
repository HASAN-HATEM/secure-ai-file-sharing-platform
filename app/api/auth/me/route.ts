import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { query } from '@/lib/db';
import { findUserByEmail, updateUser } from '@/lib/users';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { rows } = await query(
    'SELECT id, email, name, role, key_salt, avatar_url, created_at, email_verified, utm_email FROM users WHERE id = $1',
    [Number(session.user.id)]
  );
  if (!rows[0]) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const row = rows[0];
  return NextResponse.json({
    user: {
      ...row,
      keySalt: Buffer.from(row.key_salt).toString('base64'),
      avatarUrl: row.avatar_url ? `/api/auth/me/avatar` : null,
      emailVerified: row.email_verified,
      utmEmail: row.utm_email ?? null
    }
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

  const { name, email } = body as { name?: string; email?: string };
  if (!name?.trim() && !email?.trim()) {
    return NextResponse.json({ error: 'Provide at least name or email to update' }, { status: 400 });
  }

  if (email?.trim()) {
    const existing = await findUserByEmail(email.trim());
    if (existing && String(existing.id) !== String(session.user.id)) {
      return NextResponse.json({ error: 'Email already in use by another account' }, { status: 409 });
    }
  }

  const updated = await updateUser(Number(session.user.id), {
    name: name?.trim() || undefined,
    email: email?.trim() || undefined
  });

  return NextResponse.json({ ok: true, user: updated });
}
