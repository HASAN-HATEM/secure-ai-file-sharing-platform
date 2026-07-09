import { NextRequest, NextResponse } from 'next/server';
import { resolveOwnerId } from '@/lib/request-user';
import { findUserByEmail } from '@/lib/users';
import { addFriend, listFriends } from '@/lib/friends';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const ownerId = await resolveOwnerId(req);
  if (!ownerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const friends = await listFriends(Number(ownerId));
  return NextResponse.json({ friends });
}

export async function POST(req: NextRequest) {
  const ownerId = await resolveOwnerId(req);
  if (!ownerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.toLowerCase().trim() : '';
  if (!email) return NextResponse.json({ error: 'email is required' }, { status: 400 });

  const recipient = await findUserByEmail(email);
  if (!recipient) return NextResponse.json({ error: 'Recipient not found' }, { status: 404 });

  try {
    await addFriend(Number(ownerId), recipient.id);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to add friend' }, { status: 400 });
  }
}
