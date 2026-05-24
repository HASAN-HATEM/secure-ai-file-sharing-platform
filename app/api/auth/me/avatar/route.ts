import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { findUserById, updateUserAvatar } from '@/lib/users';
import { getObjectStream, putObjectBuffer } from '@/lib/r2';
import { query } from '@/lib/db';

export const runtime = 'nodejs';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_BYTES = 2 * 1024 * 1024;

function avatarKey(userId: number) {
  return `avatars/${userId}`;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });

  const file = form.get('avatar') as File | null;
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Only JPEG, PNG, WebP, or GIF allowed' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Avatar must be under 2 MB' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const key = avatarKey(Number(session.user.id));
  await putObjectBuffer(key, buffer, file.type);
  await updateUserAvatar(Number(session.user.id), key);

  return NextResponse.json({ ok: true, avatarUrl: '/api/auth/me/avatar' });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new NextResponse('Unauthorized', { status: 401 });

  const { rows } = await query('SELECT avatar_url FROM users WHERE id = $1', [Number(session.user.id)]);
  const storageKey = rows[0]?.avatar_url;
  if (!storageKey) return new NextResponse('Not Found', { status: 404 });

  try {
    const stream = await getObjectStream(storageKey);
    return new NextResponse(stream as any, {
      headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=300' }
    });
  } catch {
    return new NextResponse('Not Found', { status: 404 });
  }
}
