import { NextRequest, NextResponse } from 'next/server';
import { Readable } from 'stream';
import { resolveOwnerId } from '@/lib/request-user';
import { findFileForDownload, maybeRescanOnDownload, verifySharedSecret } from '@/lib/file-objects';
import { getObjectBuffer } from '@/lib/r2';
import { decryptFromStorage } from '@/lib/storage-crypto';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const ownerId = await resolveOwnerId(req);
  if (!ownerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await findFileForDownload({ fileId: params.id, requesterId: ownerId });
  if (!access || !access.file.storageKey) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const file = access.file;
  const storageKey = file.storageKey;
  if (!storageKey) {
    return NextResponse.json({ error: 'File storage key is missing' }, { status: 500 });
  }

  if (!access.isOwner) {
    const secret = req.nextUrl.searchParams.get('secret') || req.headers.get('x-shared-secret') || '';
    if (!secret) {
      return NextResponse.json({ error: 'Secret is required for shared downloads' }, { status: 403 });
    }
    const ok = await verifySharedSecret(secret, access.permission.secretHash);
    if (!ok) {
      return NextResponse.json({ error: 'Invalid shared secret' }, { status: 403 });
    }
  }

  if (!file.encAlgo || !file.encIvBase64 || !file.encTagBase64 || !file.encDekBase64) {
    return NextResponse.json({ error: 'File encryption metadata is incomplete' }, { status: 500 });
  }

  const ciphertext = await getObjectBuffer(storageKey);
  const plaintext = decryptFromStorage({
    ciphertext,
    encAlgo: file.encAlgo,
    encIvBase64: file.encIvBase64,
    encTagBase64: file.encTagBase64,
    encDekBase64: file.encDekBase64
  });

  await maybeRescanOnDownload(plaintext);

  const stream = Readable.from(plaintext);
  return new NextResponse(stream as any, {
    status: 200,
    headers: {
      'Content-Type': file.mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(file.filename)}"`,
      'Content-Length': String(plaintext.length),
      'Cache-Control': 'no-store'
    }
  });
}
