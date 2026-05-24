import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';
import { logAudit } from '@/lib/audit';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { rows } = await query('SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC');
  return NextResponse.json({ users: rows });
}

export async function PATCH(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await req.json();
  const { userId, role } = body;
  if (!userId || !role) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  await query('UPDATE users SET role=$1 WHERE id=$2', [role, userId]);
  await logAudit(user.id, 'ROLE_CHANGE', 'user', userId, { role });
  return NextResponse.json({ ok: true });
}
