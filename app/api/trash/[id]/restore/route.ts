import { NextRequest, NextResponse } from 'next/server';
import { restoreFileObject } from '@/lib/file-objects';
import { resolveOwnerId } from '@/lib/request-user';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ownerId = await resolveOwnerId(req);
  if (!ownerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    await restoreFileObject(ownerId, params.id);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Restore failed' }, { status: 400 });
  }
}
