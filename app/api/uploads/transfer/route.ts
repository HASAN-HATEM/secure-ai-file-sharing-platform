import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { putObjectBuffer } from '@/lib/r2';
import { resolveOwnerId } from '@/lib/request-user';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const ownerId = await resolveOwnerId(req);
  if (!ownerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });

  const fileId = String(form.get('fileId') || '').trim();
  const tempKey = String(form.get('tempKey') || '').trim();
  const file = form.get('file');

  if (!fileId || !tempKey || !(file instanceof File)) {
    return NextResponse.json({ error: 'Missing fileId, tempKey, or file' }, { status: 400 });
  }

  const record = await prisma.fileObject.findUnique({ where: { id: fileId } });
  if (!record || record.ownerId !== ownerId) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
  if (record.tempKey !== tempKey) {
    return NextResponse.json({ error: 'Temp key mismatch' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  await putObjectBuffer(tempKey, buffer, file.type || record.mimeType || 'application/octet-stream');

  return NextResponse.json({ ok: true });
}
