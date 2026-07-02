import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { findUserById, updateUserPackage } from '@/lib/users';
import { PACKAGES, getPackage, isValidPackageKey } from '@/lib/packages';
import { getUserStorageUsedBytes } from '@/lib/storage-usage';
import { logAudit } from '@/lib/audit';

export const runtime = 'nodejs';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = Number(session.user.id);
  const user = await findUserById(userId);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const usedBytes = await getUserStorageUsedBytes(userId);
  return NextResponse.json({
    currentKey:    user.package_key || 'free',
    packages:      PACKAGES,
    usedBytes,
    utmEmail:      user.utm_email ?? null,
    emailVerified: user.email_verified ?? true,
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = Number(session.user.id);
  const body = await req.json().catch(() => null);
  const packageKey = typeof body?.packageKey === 'string' ? body.packageKey : '';

  if (!isValidPackageKey(packageKey)) {
    return NextResponse.json({ error: 'Invalid package' }, { status: 400 });
  }

  if (packageKey === 'edu') {
    const user = await findUserById(userId);
    if (!user?.utm_email) {
      return NextResponse.json({ error: 'edu_requires_utm' }, { status: 400 });
    }
  }

  const target = getPackage(packageKey);
  const usedBytes = await getUserStorageUsedBytes(userId);
  if (usedBytes > target.storageLimitBytes) {
    return NextResponse.json(
      { error: `Your current usage exceeds the ${target.name} plan's storage limit. Free up space before switching.` },
      { status: 400 }
    );
  }

  await updateUserPackage(userId, packageKey);
  await logAudit(userId, 'PACKAGE_CHANGE', 'user', userId, { packageKey }).catch(() => null);

  return NextResponse.json({ ok: true, currentKey: packageKey });
}
