import { query } from './db';

export async function logAudit(actorId: number | null, action: string, targetType: string, targetId: number | null, details: any = {}) {
  await query(
    'INSERT INTO audit_logs (actor_user_id, action, target_type, target_id, details) VALUES ($1, $2, $3, $4, $5)',
    [actorId, action, targetType, targetId, details]
  );
}
