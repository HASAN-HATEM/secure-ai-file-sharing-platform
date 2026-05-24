import bcrypt from 'bcryptjs';
import { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { query } from './db';

export type Role = 'USER' | 'ADMIN';

export async function hashPassword(password: string) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function getUserFromRequest(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET
  });
  if (!token) return null;

  const userId = Number(token.sub);
  if (!Number.isFinite(userId)) return null;

  try {
    const { rows } = await query('SELECT id, email, name, role, key_salt, created_at FROM users WHERE id = $1', [userId]);
    if (!rows[0]) return null;
    return {
      ...rows[0],
      keySalt: Buffer.from(rows[0].key_salt).toString('base64')
    };
  } catch {
    return null;
  }
}
