import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // Only admins can see global analytics
  if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const [{ rows: users }, { rows: fileStats }, { rows: threats }, { rows: clean }, { rows: distribution }] = await Promise.all([
    query('SELECT COUNT(*)::int AS total_users FROM users'),
    query('SELECT COUNT(*)::int AS total_files, COALESCE(SUM(size_bytes),0)::bigint AS total_bytes FROM files'),
    query('SELECT COUNT(*)::int AS threats_blocked FROM scan_results WHERE is_malicious = true'),
    query('SELECT COUNT(*)::int AS clean_files FROM scan_results WHERE is_malicious = false'),
    query('SELECT mime_type, COUNT(*)::int AS count FROM files GROUP BY mime_type ORDER BY count DESC LIMIT 10')
  ]);

  return NextResponse.json({
    totalUsers: users[0]?.total_users ?? 0,
    totalFiles: fileStats[0]?.total_files ?? 0,
    totalBytes: Number(fileStats[0]?.total_bytes ?? 0),
    threatsBlocked: threats[0]?.threats_blocked ?? 0,
    cleanFiles: clean[0]?.clean_files ?? 0,
    distribution: distribution || []
  });
}
