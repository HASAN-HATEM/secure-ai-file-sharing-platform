import { NextRequest, NextResponse } from 'next/server';
import { finalizeUpload } from '@/lib/file-objects';
import { resolveOwnerId } from '@/lib/request-user';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const ownerId = await resolveOwnerId(req);
  if (!ownerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

  const fileId = String(body.fileId || '').trim();
  const tempKey = String(body.tempKey || '').trim();
  if (!fileId || !tempKey) {
    return NextResponse.json({ error: 'Missing fileId or tempKey' }, { status: 400 });
  }

  try {
    const result = await finalizeUpload({ ownerId, fileId, tempKey });
    if (!result.ok) {
      return NextResponse.json(result, { status: 422 });
    }
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to finalize upload' }, { status: 400 });
  }
}
