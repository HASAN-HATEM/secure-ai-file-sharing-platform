import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { getMaintenanceMode, setMaintenanceMode } from '@/lib/system-settings';
import { logAudit } from '@/lib/audit';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const maintenanceMode = await getMaintenanceMode();
  return NextResponse.json({ maintenanceMode });
}

export async function PATCH(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (typeof body?.maintenanceMode !== 'boolean') {
    return NextResponse.json({ error: 'maintenanceMode (boolean) is required' }, { status: 400 });
  }

  await setMaintenanceMode(body.maintenanceMode);
  await logAudit(user.id, body.maintenanceMode ? 'MAINTENANCE_MODE_ENABLED' : 'MAINTENANCE_MODE_DISABLED', 'system', null, {});

  return NextResponse.json({ ok: true, maintenanceMode: body.maintenanceMode });
}
