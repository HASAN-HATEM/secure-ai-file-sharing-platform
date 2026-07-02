import { query } from '@/lib/db';
import { prisma } from '@/lib/prisma';

export async function getUserStorageUsedBytes(userId: number): Promise<number> {
  const [legacy, v2] = await Promise.all([
    query('SELECT COALESCE(SUM(size_bytes), 0) AS total FROM files WHERE owner_id = $1', [userId]),
    prisma.fileObject.aggregate({
      where: { ownerId: String(userId), status: 'READY', deletedAt: null },
      _sum: { sizeBytes: true }
    })
  ]);

  const legacyTotal = Number(legacy.rows[0]?.total || 0);
  const v2Total = Number(v2._sum.sizeBytes || 0);
  return legacyTotal + v2Total;
}
