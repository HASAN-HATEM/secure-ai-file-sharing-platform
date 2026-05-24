import { NextRequest, NextResponse } from 'next/server';
import { listReadyFiles } from '@/lib/file-objects';
import { resolveOwnerId } from '@/lib/request-user';

export async function GET(req: NextRequest) {
  const ownerId = await resolveOwnerId(req);
  if (!ownerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const files = await listReadyFiles(ownerId);
  return NextResponse.json({ files });
}
