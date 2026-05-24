import { NextRequest, NextResponse } from 'next/server';
import { findUserByEmail } from '@/lib/users';
import { hashPassword } from '@/lib/auth';
import { query } from '@/lib/db';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { email, newPassword, token } = body;
  if (!email) return NextResponse.json({ error: 'Missing email' }, { status: 400 });
  const user = await findUserByEmail(email);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (!newPassword || token !== 'demo-reset') {
    return NextResponse.json({ message: 'Reset token required (demo-reset)' }, { status: 200 });
  }
  const hash = await hashPassword(newPassword);
  await query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, user.id]);
  return NextResponse.json({ ok: true });
}
