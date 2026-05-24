import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { findUserById, updateUserPassword } from '@/lib/users';
import { hashPassword, verifyPassword } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

  const { currentPassword, newPassword } = body as { currentPassword?: string; newPassword?: string };

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'currentPassword and newPassword are required' }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 });
  }

  const user = await findUserById(Number(session.user.id));
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const valid = await verifyPassword(currentPassword, user.password_hash);
  if (!valid) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });

  const newHash = await hashPassword(newPassword);
  await updateUserPassword(user.id, newHash);

  return NextResponse.json({ ok: true });
}
