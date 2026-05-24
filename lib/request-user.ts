import { NextRequest } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';

export async function resolveOwnerId(req: NextRequest): Promise<string | null> {
  const user = await getUserFromRequest(req);
  if (user?.id) return String(user.id);
  if (process.env.NODE_ENV === 'development') return 'dev-user';
  return null;
}
