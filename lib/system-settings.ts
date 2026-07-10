import { query } from './db';

export async function getMaintenanceMode(): Promise<boolean> {
  const { rows } = await query('SELECT maintenance_mode FROM system_settings WHERE id = 1');
  return rows[0]?.maintenance_mode ?? false;
}

export async function setMaintenanceMode(enabled: boolean): Promise<void> {
  await query(
    'UPDATE system_settings SET maintenance_mode = $1, updated_at = now() WHERE id = 1',
    [enabled]
  );
}
