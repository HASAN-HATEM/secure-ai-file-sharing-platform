import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { listReadyFiles } from '@/lib/file-objects';
import { resolveOwnerId } from '@/lib/request-user';

export async function GET(req: NextRequest) {
  const ownerId = await resolveOwnerId(req);
  if (!ownerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const files = await listReadyFiles(ownerId);
  const { rows: activity } = await query('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 20');
  return NextResponse.json({
    files: files.map((file: any) => ({
      id: file.id,
      filename: file.filename,
      mime_type: file.mimeType,
      size_bytes: file.sizeBytes,
      created_at: file.createdAt,
      category_label: file.categoryLabel,
      category_confidence: file.categoryConfidence,
      is_owner: file.isOwner,
      owner_name: file.ownerName,
      owner_email: file.ownerEmail,
      secret_required: file.secretRequired
    })),
    activity
  });
}
