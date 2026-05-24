import crypto from 'crypto';

const FILE_IV_BYTES = 12;
const GCM_TAG_BYTES = 16;

function getMasterKey() {
  const value = process.env.FILE_MASTER_KEY_BASE64;
  if (!value) {
    throw new Error('Missing required env var: FILE_MASTER_KEY_BASE64');
  }
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32) {
    throw new Error('FILE_MASTER_KEY_BASE64 must decode to exactly 32 bytes');
  }
  return key;
}

export function getEncKeyId() {
  return process.env.FILE_MASTER_KEY_ID || 'master-key-v1';
}

export function encryptForStorage(plaintext: Buffer) {
  const dek = crypto.randomBytes(32);
  const fileIv = crypto.randomBytes(FILE_IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', dek, fileIv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const fileTag = cipher.getAuthTag();

  const masterKey = getMasterKey();
  const dekIv = crypto.randomBytes(FILE_IV_BYTES);
  const dekCipher = crypto.createCipheriv('aes-256-gcm', masterKey, dekIv);
  const wrappedDek = Buffer.concat([dekCipher.update(dek), dekCipher.final()]);
  const dekTag = dekCipher.getAuthTag();

  return {
    ciphertext,
    encAlgo: 'AES-256-GCM',
    encIvBase64: fileIv.toString('base64'),
    encTagBase64: fileTag.toString('base64'),
    encKeyId: getEncKeyId(),
    encDekBase64: Buffer.concat([dekIv, dekTag, wrappedDek]).toString('base64')
  };
}

export function decryptFromStorage(options: {
  ciphertext: Buffer;
  encAlgo: string;
  encIvBase64: string;
  encTagBase64: string;
  encDekBase64: string;
}) {
  if (options.encAlgo !== 'AES-256-GCM') {
    throw new Error('Unsupported encryption algorithm');
  }

  const wrapped = Buffer.from(options.encDekBase64, 'base64');
  if (wrapped.length <= FILE_IV_BYTES + GCM_TAG_BYTES) {
    throw new Error('Invalid wrapped key payload');
  }
  const dekIv = wrapped.subarray(0, FILE_IV_BYTES);
  const dekTag = wrapped.subarray(FILE_IV_BYTES, FILE_IV_BYTES + GCM_TAG_BYTES);
  const wrappedDek = wrapped.subarray(FILE_IV_BYTES + GCM_TAG_BYTES);

  const masterKey = getMasterKey();
  const dekDecipher = crypto.createDecipheriv('aes-256-gcm', masterKey, dekIv);
  dekDecipher.setAuthTag(dekTag);
  const dek = Buffer.concat([dekDecipher.update(wrappedDek), dekDecipher.final()]);

  const iv = Buffer.from(options.encIvBase64, 'base64');
  const tag = Buffer.from(options.encTagBase64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', dek, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(options.ciphertext), decipher.final()]);
}
