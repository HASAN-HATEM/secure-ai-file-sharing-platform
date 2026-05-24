import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { query } from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { rows } = await query('SELECT id, email, name, role, key_salt, created_at FROM users WHERE id = $1', [Number(session.user.id)]);
  if (!rows[0]) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return NextResponse.json({
    user: {
      ...rows[0],
      keySalt: Buffer.from(rows[0].key_salt).toString('base64')
    }
  });
}
