import { NextRequest, NextResponse } from 'next/server';
import { createUploadTicket } from '@/lib/file-objects';
import { resolveOwnerId } from '@/lib/request-user';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const ownerId = await resolveOwnerId(req);
  if (!ownerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

  const filename = String(body.filename || '').trim();
  const mimeType = String(body.mimeType || '').trim();
  const sizeBytes = Number(body.sizeBytes || 0);

  if (!filename || !mimeType || !Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  try {
    const payload = await createUploadTicket({ ownerId, filename, mimeType, sizeBytes });
    return NextResponse.json(payload);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to create upload ticket' }, { status: 400 });
  }
}
