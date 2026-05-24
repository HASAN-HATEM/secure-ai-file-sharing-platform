import crypto from 'crypto';
import { query } from './db';
import { hashPassword } from './auth';

export type UserRecord = {
  id: number;
  name: string;
  email: string;
  role: string;
  key_salt: Buffer;
  password_hash: string;
  avatar_url?: string | null;
};

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

export async function findUserById(id: number): Promise<UserRecord | null> {
  const { rows } = await query('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function updateUser(id: number, updates: { name?: string; email?: string }) {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  if (updates.name !== undefined) { fields.push(`name = $${idx++}`); values.push(updates.name.trim()); }
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

export async function ensureAdminUser() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@secure.local';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const existing = await findUserByEmail(adminEmail);
  if (existing) return existing;
  return createUser('admin', adminEmail, adminPassword, 'ADMIN');
}
