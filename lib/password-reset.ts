import crypto from 'crypto';
import { query } from './db';

const RESET_EXPIRES_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 5;

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export async function isRateLimited(ipAddress: string): Promise<boolean> {
  const { rows } = await query(
    `SELECT COUNT(*) AS count
     FROM password_reset_tokens
     WHERE ip_address = $1
       AND created_at > NOW() - INTERVAL '15 minutes'`,
    [ipAddress]
  );
  return Number(rows[0]?.count ?? 0) >= RATE_LIMIT_MAX;
}

export async function createPasswordResetToken(
  userId: number,
  ipAddress: string
): Promise<string> {
  const raw = crypto.randomBytes(32).toString('hex');
  const hash = hashToken(raw);
  const expiresAt = new Date(Date.now() + RESET_EXPIRES_MS);

  // Invalidate any live tokens for this user so only one is active at a time
  await query(
    `UPDATE password_reset_tokens
     SET used_at = NOW()
     WHERE user_id = $1 AND used_at IS NULL AND expires_at > NOW()`,
    [userId]
  );

  await query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, ip_address)
     VALUES ($1, $2, $3, $4)`,
    [userId, hash, expiresAt, ipAddress]
  );

  return raw;
}

export async function verifyAndConsumeToken(
  raw: string
): Promise<{ userId: number } | null> {
  const hash = hashToken(raw);

  const { rows } = await query(
    `SELECT id, user_id
     FROM password_reset_tokens
     WHERE token_hash = $1
       AND used_at IS NULL
       AND expires_at > NOW()`,
    [hash]
  );

  if (!rows[0]) return null;

  await query(
    `UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1`,
    [rows[0].id]
  );

  return { userId: rows[0].user_id };
}
