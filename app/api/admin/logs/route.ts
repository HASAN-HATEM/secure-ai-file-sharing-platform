import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { rows } = await query(
    `SELECT l.*, u.email, u.name 
     FROM audit_logs l 
     LEFT JOIN users u ON u.id = l.user_id
     ORDER BY l.timestamp DESC
     LIMIT 100`
  );
  return NextResponse.json({ logs: rows });
}
