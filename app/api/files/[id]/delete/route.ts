import { NextRequest, NextResponse } from 'next/server';
import { resolveOwnerId } from '@/lib/request-user';
import { deleteFileObject } from '@/lib/file-objects';

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const ownerId = await resolveOwnerId(req);
  if (!ownerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    await deleteFileObject(ownerId, params.id);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error deleting' }, { status: 400 });
  }
}
