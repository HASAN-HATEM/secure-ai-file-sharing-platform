import { describe, it, expect } from 'vitest';
import { canDownload } from '../lib/files';

describe('download permissions', () => {
  const file = { id: 1, owner_id: 1 } as any;
  it('allows owner', () => {
    expect(canDownload(file, 1, 'USER' as any)).toBe(true);
  });
  it('allows admin', () => {
    expect(canDownload(file, 2, 'ADMIN' as any)).toBe(true);
  });
  it('allows shared users with permission', () => {
    expect(canDownload(file, 3, 'USER' as any, { user_id: 3, can_download: true })).toBe(true);
  });
  it('blocks without permission', () => {
    expect(canDownload(file, 4, 'USER' as any, { user_id: 4, can_download: false })).toBe(false);
  });
});
