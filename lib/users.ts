import crypto from 'crypto';
import { query } from './db';
import { hashPassword } from './auth';

export type UserRecord = {
  id: number;
  name: string;
  email: string;
  role: string;
  package_key: string;
  key_salt: Buffer;
  password_hash: string;
  avatar_url?: string | null;
  email_verified: boolean;
  utm_email?: string | null;
  disabled: boolean;
};

const EMAIL_VERIFY_EXPIRES_MS = 24 * 60 * 60 * 1000;
const UTM_VERIFY_EXPIRES_MS   = 30 * 60 * 1000;

export const UTM_DOMAINS = ['utm.my', 'graduate.utm.my'];

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export function isUtmEmail(email: string): boolean {
  const domain = email.toLowerCase().split('@')[1];
  return UTM_DOMAINS.includes(domain ?? '');
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const { rows } = await query('SELECT * FROM users WHERE lower(email) = lower($1)', [email]);
  return rows[0] || null;
}

export async function createUser(
  name: string,
  email: string,
  password: string,
  role: 'USER' | 'ADMIN' = 'USER',
  emailVerified = false
) {
  const keySalt = crypto.randomBytes(16);
  const passwordHash = await hashPassword(password);
  const { rows } = await query(
    'INSERT INTO users (name, email, password_hash, role, key_salt, email_verified) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, role, key_salt, password_hash',
    [name, email.toLowerCase(), passwordHash, role, keySalt, emailVerified]
  );
  return rows[0] as UserRecord;
}

export async function findUserById(id: number): Promise<UserRecord | null> {
  const { rows } = await query('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function updateUser(id: number, updates: { name?: string; email?: string }) {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  if (updates.name !== undefined)  { fields.push(`name = $${idx++}`);  values.push(updates.name.trim()); }
  if (updates.email !== undefined) { fields.push(`email = $${idx++}`); values.push(updates.email.toLowerCase().trim()); }
  if (!fields.length) return null;
  values.push(id);
  const { rows } = await query(
    `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, name, email, role`,
    values
  );
  return rows[0] as Pick<UserRecord, 'id' | 'name' | 'email' | 'role'> | null;
}

export async function updateUserPassword(id: number, newHash: string) {
  await query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, id]);
}

export async function updateUserAvatar(id: number, storageKey: string) {
  const { rows } = await query(
    'UPDATE users SET avatar_url = $1 WHERE id = $2 RETURNING id, avatar_url',
    [storageKey, id]
  );
  return rows[0];
}

export async function updateUserPackage(id: number, packageKey: string) {
  const { rows } = await query(
    'UPDATE users SET package_key = $1 WHERE id = $2 RETURNING id, package_key',
    [packageKey, id]
  );
  return rows[0];
}

export async function createEmailVerificationToken(userId: number): Promise<string> {
  const raw = crypto.randomBytes(32).toString('hex');
  const hash = hashToken(raw);
  const expiresAt = new Date(Date.now() + EMAIL_VERIFY_EXPIRES_MS);
  await query(
    'UPDATE users SET email_verification_token = $1, email_verification_expires_at = $2 WHERE id = $3',
    [hash, expiresAt, userId]
  );
  return raw;
}

export async function verifyEmailToken(raw: string): Promise<number | null> {
  const hash = hashToken(raw);
  const { rows } = await query(
    `UPDATE users
     SET email_verified = true
     WHERE email_verification_token = $1 AND email_verification_expires_at > NOW()
     RETURNING id`,
    [hash]
  );
  return rows[0]?.id ?? null;
}

export async function requestUtmVerification(userId: number, utmEmail: string): Promise<string> {
  const raw = crypto.randomBytes(32).toString('hex');
  const hash = hashToken(raw);
  const expiresAt = new Date(Date.now() + UTM_VERIFY_EXPIRES_MS);
  await query(
    `UPDATE users
     SET utm_verification_token = $1, utm_verification_pending_email = $2, utm_verification_expires_at = $3
     WHERE id = $4`,
    [hash, utmEmail.toLowerCase(), expiresAt, userId]
  );
  return raw;
}

export async function confirmUtmVerification(raw: string): Promise<number | null> {
  const hash = hashToken(raw);
  const { rows } = await query(
    `UPDATE users
     SET utm_email = utm_verification_pending_email, package_key = 'edu',
         utm_verification_token = NULL, utm_verification_pending_email = NULL,
         utm_verification_expires_at = NULL
     WHERE utm_verification_token = $1 AND utm_verification_expires_at > NOW()
     RETURNING id`,
    [hash]
  );
  return rows[0]?.id ?? null;
}

export async function ensureAdminUser() {
  const adminEmail    = process.env.ADMIN_EMAIL    || 'admin@secure.local';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const existing = await findUserByEmail(adminEmail);
  if (existing) return existing;
  return createUser('admin', adminEmail, adminPassword, 'ADMIN', true);
}
