import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../lib/auth';
import { assertRole } from '../lib/rbac';

describe('auth + rbac', () => {
  it('hashes and verifies password', async () => {
    const hash = await hashPassword('secret');
    expect(hash).toBeTruthy();
    const valid = await verifyPassword('secret', hash);
    expect(valid).toBe(true);
  });

  it('assertRole forbids when not allowed', () => {
    expect(() => assertRole('USER', ['ADMIN' as any])).toThrow();
    expect(() => assertRole('ADMIN', ['ADMIN' as any])).not.toThrow();
  });
});
