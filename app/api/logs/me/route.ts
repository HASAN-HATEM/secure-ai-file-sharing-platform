import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { rows } = await query(
    `SELECT * FROM audit_logs WHERE actor_user_id = $1 ORDER BY timestamp DESC LIMIT 100`,
    [user.id]
  );
  return NextResponse.json({ logs: rows });
}
