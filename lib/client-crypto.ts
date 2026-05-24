export async function deriveUserKey(password: string, keySaltB64: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  const salt = Uint8Array.from(atob(keySaltB64), (c) => c.charCodeAt(0));
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['wrapKey', 'unwrapKey', 'encrypt', 'decrypt']
  );
}

export async function generateFileKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

async function generateMasterKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['wrapKey', 'unwrapKey', 'encrypt', 'decrypt']);
}

export async function encryptFile(file: File, userKey: CryptoKey) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const wrapIv = crypto.getRandomValues(new Uint8Array(12));
  const fileKey = await generateFileKey();
  const rawFile = await file.arrayBuffer();
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, fileKey, rawFile);
  const wrapped = await crypto.subtle.wrapKey('raw', fileKey, userKey, { name: 'AES-GCM', iv: wrapIv });
  const rawFileKey = new Uint8Array(await crypto.subtle.exportKey('raw', fileKey));
  return {
    encrypted: new Uint8Array(encrypted),
    iv: btoa(String.fromCharCode(...iv)),
    wrapIv: btoa(String.fromCharCode(...wrapIv)),
    wrappedKey: btoa(String.fromCharCode(...new Uint8Array(wrapped))),
    rawFileKey
  };
}

export async function decryptFile(encryptedB64: string, ivB64: string, wrappedKeyB64: string, wrapIvB64: string, userKey: CryptoKey) {
  const encrypted = Uint8Array.from(atob(encryptedB64), (c) => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));
  const wrapIv = Uint8Array.from(atob(wrapIvB64), (c) => c.charCodeAt(0));
  const wrappedKey = Uint8Array.from(atob(wrappedKeyB64), (c) => c.charCodeAt(0));
  const fileKey = await crypto.subtle.unwrapKey('raw', wrappedKey, userKey, { name: 'AES-GCM', iv: wrapIv }, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, fileKey, encrypted);
  return new Uint8Array(decrypted);
}

export function toBase64(uint: Uint8Array) {
  return btoa(String.fromCharCode(...uint));
}

async function importAesKeyFromB64(b64: string) {
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['wrapKey', 'unwrapKey', 'encrypt', 'decrypt']);
}

export async function getOrCreateUserKey(): Promise<CryptoKey> {
  const existing = typeof localStorage !== 'undefined' ? localStorage.getItem('userMasterKey') : null;
  if (existing) {
    try { return await importAesKeyFromB64(existing); } catch { /* fall through */ }
  }
  const key = await generateMasterKey();
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', key));
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('userMasterKey', toBase64(raw));
  }
  return key;
}
