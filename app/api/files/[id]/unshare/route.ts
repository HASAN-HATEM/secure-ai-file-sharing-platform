import { NextRequest, NextResponse } from 'next/server';
import { resolveOwnerId } from '@/lib/request-user';
import { removeSharedAccess } from '@/lib/file-objects';

export const runtime = 'nodejs';

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await resolveOwnerId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const numericUserId = Number(userId);
  if (!Number.isFinite(numericUserId)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await removeSharedAccess(numericUserId, params.id);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error removing' }, { status: 400 });
  }
}
