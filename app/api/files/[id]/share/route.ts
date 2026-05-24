import { NextRequest, NextResponse } from 'next/server';
import { resolveOwnerId } from '@/lib/request-user';
import { findUserByEmail } from '@/lib/users';
import { shareFileObject } from '@/lib/file-objects';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ownerId = await resolveOwnerId(req);
  if (!ownerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

  const recipientEmail = String(body.recipientEmail || '').toLowerCase().trim();
  const sharedSecret = String(body.sharedSecret || '');
  if (!recipientEmail || !sharedSecret) {
    return NextResponse.json({ error: 'recipientEmail and sharedSecret are required' }, { status: 400 });
  }

  const recipient = await findUserByEmail(recipientEmail);
  if (!recipient) {
    return NextResponse.json({ error: 'Recipient not found' }, { status: 404 });
  }

  try {
    await shareFileObject({
      fileId: params.id,
      ownerId,
      recipientUserId: recipient.id,
      sharedSecret
    });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Share failed' }, { status: 400 });
  }
}
