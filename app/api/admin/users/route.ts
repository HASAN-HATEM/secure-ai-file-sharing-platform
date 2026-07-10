import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';
import { logAudit } from '@/lib/audit';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { rows } = await query('SELECT id, name, email, role, disabled, created_at FROM users ORDER BY created_at DESC');
  return NextResponse.json({ users: rows });
}

export async function PATCH(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await req.json();
  const { userId, role, disabled } = body;
  if (!userId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  if (Number(userId) === Number(user.id) && (role !== undefined || disabled === true)) {
    return NextResponse.json({ error: 'You cannot change your own role or block yourself' }, { status: 400 });
  }

  if (role !== undefined) {
    await query('UPDATE users SET role=$1 WHERE id=$2', [role, userId]);
    await logAudit(user.id, 'ROLE_CHANGE', 'user', userId, { role });
  }
  if (disabled !== undefined) {
    await query('UPDATE users SET disabled=$1 WHERE id=$2', [disabled, userId]);
    await logAudit(user.id, disabled ? 'USER_BLOCKED' : 'USER_UNBLOCKED', 'user', userId, {});
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  if (Number(userId) === Number(user.id)) {
    return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 });
  }

  try {
    await query('DELETE FROM users WHERE id=$1', [userId]);
  } catch (err: any) {
    if (err?.code === '23503') {
      return NextResponse.json(
        { error: 'Cannot delete: this user still owns files or shares. Block them instead, or remove their files first.' },
        { status: 409 }
      );
    }
    throw err;
  }

  await logAudit(user.id, 'USER_DELETE', 'user', Number(userId), {});
  return NextResponse.json({ ok: true });
}
