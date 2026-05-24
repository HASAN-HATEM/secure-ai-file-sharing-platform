import { query } from './db';
import { logAudit } from './audit';
import { Role } from './auth';

export type FileRecord = {
  id: number;
  owner_id: number;
  filename: string;
  mime_type: string;
  size_bytes: number;
  iv: string;
  wrap_iv: string;
  wrapped_key: string;
  created_at: string;
};

export async function saveFile(options: {
  ownerId: number;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  encryptedBlob: Buffer;
  iv: string;
  wrapIv: string;
  wrappedKey: string;
}) {
  const { rows } = await query(
    'INSERT INTO files (owner_id, filename, mime_type, size_bytes, encrypted_blob, iv, wrap_iv, wrapped_key) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
    [options.ownerId, options.filename, options.mimeType, options.sizeBytes, options.encryptedBlob, options.iv, options.wrapIv, options.wrappedKey]
  );
  await logAudit(options.ownerId, 'FILE_UPLOAD', 'file', rows[0].id, { filename: options.filename });
  return rows[0] as FileRecord;
}

export async function listFiles(userId: number, role: Role) {
  if (role === 'ADMIN') {
    const { rows } = await query('SELECT * FROM files ORDER BY created_at DESC LIMIT 200');
    return rows;
  }
  const { rows } = await query(
    `SELECT f.*, TRUE AS is_owner
     FROM files f WHERE f.owner_id = $1
     UNION
     SELECT f.*, FALSE AS is_owner
     FROM files f
     JOIN file_permissions p ON p.file_id = f.id
     WHERE p.user_id = $1
     ORDER BY created_at DESC`
  , [userId]);
  return rows;
}

export async function getFileAccessible(fileId: number, userId: number, role: Role) {
  if (role === 'ADMIN') {
    const { rows } = await query('SELECT * FROM files WHERE id=$1', [fileId]);
    return rows[0];
  }
  const { rows } = await query(
    `SELECT f.* FROM files f
     LEFT JOIN file_permissions p ON p.file_id = f.id AND p.user_id = $2
     WHERE f.id = $1 AND (f.owner_id = $2 OR p.user_id = $2)`,
    [fileId, userId]
  );
  return rows[0];
}

export async function deleteFile(fileId: number, userId: number, role: Role) {
  const file = await getFileAccessible(fileId, userId, role);
  if (!file) throw new Error('Not found');
  if (role !== 'ADMIN' && file.owner_id !== userId) throw new Error('Forbidden');
  await query('DELETE FROM files WHERE id = $1', [fileId]);
  await logAudit(userId, 'FILE_DELETE', 'file', fileId, {});
}

export async function shareFile(fileId: number, ownerId: number, recipientId: number, wrappedKeyForUser: string | null, wrapIvForUser: string | null) {
  const { rows } = await query('SELECT owner_id FROM files WHERE id=$1', [fileId]);
  if (!rows[0]) throw new Error('Not found');
  if (rows[0].owner_id !== ownerId) throw new Error('Forbidden');
  const res = await query(
    `INSERT INTO file_permissions (file_id, user_id, wrapped_key_for_user, wrap_iv_for_user)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (file_id, user_id) DO UPDATE SET wrapped_key_for_user = EXCLUDED.wrapped_key_for_user, wrap_iv_for_user = EXCLUDED.wrap_iv_for_user
     RETURNING *`,
    [fileId, recipientId, wrappedKeyForUser, wrapIvForUser]
  );
  await logAudit(ownerId, 'FILE_SHARE', 'file', fileId, { recipientId });
  return res.rows[0];
}

export async function getPermission(fileId: number, userId: number) {
  const { rows } = await query('SELECT * FROM file_permissions WHERE file_id=$1 AND user_id=$2', [fileId, userId]);
  return rows[0];
}

export function canDownload(file: any, userId: number, role: Role, permission?: any) {
  if (role === 'ADMIN') return true;
  if (file.owner_id === userId) return true;
  if (permission && permission.user_id === userId && permission.can_download !== false) return true;
  return false;
}

export async function recordScan(fileId: number, isMalicious: boolean, score: number | null, modelVersion: string) {
  await query('INSERT INTO scan_results (file_id, is_malicious, score, model_version) VALUES ($1,$2,$3,$4)', [fileId, isMalicious, score, modelVersion]);
}

export async function recordClassification(fileId: number, classifierType: string, label: string, confidence: number) {
  await query('INSERT INTO classification_results (file_id, classifier_type, label, confidence) VALUES ($1,$2,$3,$4)', [fileId, classifierType, label, confidence]);
}
