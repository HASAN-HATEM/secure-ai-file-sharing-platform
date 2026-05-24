import crypto from 'crypto';
import { query } from './db';
import { hashPassword } from './auth';

export type UserRecord = { id: number; name: string; email: string; role: string; key_salt: Buffer; password_hash: string };

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const { rows } = await query('SELECT * FROM users WHERE lower(email) = lower($1)', [email]);
  return rows[0] || null;
}

export async function createUser(name: string, email: string, password: string, role: 'USER' | 'ADMIN' = 'USER') {
  const keySalt = crypto.randomBytes(16);
  const passwordHash = await hashPassword(password);
  const { rows } = await query(
    'INSERT INTO users (name, email, password_hash, role, key_salt) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role, key_salt, password_hash',
    [name, email.toLowerCase(), passwordHash, role, keySalt]
  );
  return rows[0] as UserRecord;
}

export async function ensureAdminUser() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@secure.local';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const existing = await findUserByEmail(adminEmail);
  if (existing) return existing;
  return createUser('admin', adminEmail, adminPassword, 'ADMIN');
}
