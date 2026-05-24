import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { shareFile } from '@/lib/files';
import { findUserByEmail } from '@/lib/users';

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const { fileId, recipientEmail, wrappedKeyForUser, wrapIvForUser } = body;
  if (!fileId || !recipientEmail) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  const recipient = await findUserByEmail(recipientEmail);
  if (!recipient) return NextResponse.json({ error: 'Recipient not found' }, { status: 404 });
  try {
    const perm = await shareFile(fileId, user.id, recipient.id, wrappedKeyForUser || null, wrapIvForUser || null);
    return NextResponse.json({ permission: perm });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Share failed' }, { status: 400 });
  }
}
