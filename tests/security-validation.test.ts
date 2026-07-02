import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import { encryptForStorage, decryptFromStorage } from '../lib/storage-crypto';

function randomMasterKeyBase64() {
  return crypto.randomBytes(32).toString('base64');
}

function shannonEntropyBitsPerByte(buffer: Buffer) {
  const counts = new Array(256).fill(0);
  for (const byte of buffer) counts[byte]++;
  let entropy = 0;
  for (const count of counts) {
    if (count === 0) continue;
    const p = count / buffer.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

describe('encryption key randomness', () => {
  beforeEach(() => {
    process.env.FILE_MASTER_KEY_BASE64 = randomMasterKeyBase64();
  });

  it('generates a unique DEK and IV for every encryption, even for identical plaintext', () => {
    const plaintext = Buffer.from('the same file content, encrypted repeatedly');
    const samples = Array.from({ length: 50 }, () => encryptForStorage(plaintext));

    const wrappedDeks = new Set(samples.map((s) => s.encDekBase64));
    const ivs = new Set(samples.map((s) => s.encIvBase64));
    const ciphertexts = new Set(samples.map((s) => s.ciphertext.toString('base64')));

    expect(wrappedDeks.size).toBe(samples.length);
    expect(ivs.size).toBe(samples.length);
    expect(ciphertexts.size).toBe(samples.length);
  });

  it('produces wrapped key material with high entropy (not predictable/low-randomness)', () => {
    const plaintext = Buffer.from('entropy probe payload');
    const samples = Array.from({ length: 50 }, () => encryptForStorage(plaintext));
    const pooled = Buffer.concat(samples.map((s) => Buffer.from(s.encDekBase64, 'base64')));

    const entropy = shannonEntropyBitsPerByte(pooled);
    expect(entropy).toBeGreaterThan(7.5);
  });
});

describe('AES-256-GCM tamper detection', () => {
  beforeEach(() => {
    process.env.FILE_MASTER_KEY_BASE64 = randomMasterKeyBase64();
  });

  it('round-trips clean ciphertext correctly', () => {
    const plaintext = Buffer.from('confidential file contents');
    const encrypted = encryptForStorage(plaintext);
    const decrypted = decryptFromStorage(encrypted);
    expect(decrypted.equals(plaintext)).toBe(true);
  });

  it('rejects a flipped bit in the ciphertext', () => {
    const encrypted = encryptForStorage(Buffer.from('confidential file contents'));
    const tampered = Buffer.from(encrypted.ciphertext);
    tampered[0] ^= 0xff;
    expect(() => decryptFromStorage({ ...encrypted, ciphertext: tampered })).toThrow();
  });

  it('rejects a tampered authentication tag', () => {
    const encrypted = encryptForStorage(Buffer.from('confidential file contents'));
    const tagBytes = Buffer.from(encrypted.encTagBase64, 'base64');
    tagBytes[0] ^= 0xff;
    expect(() =>
      decryptFromStorage({ ...encrypted, encTagBase64: tagBytes.toString('base64') })
    ).toThrow();
  });

  it('rejects a tampered wrapped DEK', () => {
    const encrypted = encryptForStorage(Buffer.from('confidential file contents'));
    const wrapped = Buffer.from(encrypted.encDekBase64, 'base64');
    wrapped[wrapped.length - 1] ^= 0xff;
    expect(() =>
      decryptFromStorage({ ...encrypted, encDekBase64: wrapped.toString('base64') })
    ).toThrow();
  });
});

describe('master key isolation (attack resistance)', () => {
  it('fails to unwrap the DEK when decrypted with a different master key', () => {
    process.env.FILE_MASTER_KEY_BASE64 = randomMasterKeyBase64();
    const encrypted = encryptForStorage(Buffer.from('confidential file contents'));

    process.env.FILE_MASTER_KEY_BASE64 = randomMasterKeyBase64();
    expect(() => decryptFromStorage(encrypted)).toThrow();
  });

  it('rejects an unsupported encryption algorithm label', () => {
    process.env.FILE_MASTER_KEY_BASE64 = randomMasterKeyBase64();
    const encrypted = encryptForStorage(Buffer.from('confidential file contents'));
    expect(() => decryptFromStorage({ ...encrypted, encAlgo: 'AES-256-CBC' })).toThrow();
  });
});
