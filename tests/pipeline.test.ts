import { describe, it, expect, vi } from 'vitest';
import { handleUpload } from '../lib/pipeline';
import * as ai from '../lib/aiClient';
import * as files from '../lib/files';
import * as audit from '../lib/audit';

vi.mock('../lib/audit', () => ({ logAudit: vi.fn(async () => {}) }));

const cleanScan = { is_malicious: false, score: 0.01, model_version: 'stub' };

describe('upload pipeline', () => {
  it('blocks malicious files', async () => {
    vi.spyOn(ai, 'scanMalware').mockResolvedValue({ is_malicious: true, score: 0.9, model_version: 'stub' });
    await expect(
      handleUpload({ userId: 1, filename: 'bad.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('virus'), iv: 'iv', wrapIv: 'wiv', wrappedKey: 'wk' })
    ).rejects.toThrow('Malicious file blocked');
  });

  it('stores clean files and classifies text', async () => {
    vi.spyOn(ai, 'scanMalware').mockResolvedValue(cleanScan as any);
    vi.spyOn(files, 'saveFile').mockResolvedValue({ id: 5, owner_id: 1, filename: 'doc.txt', mime_type: 'text/plain', size_bytes: 4, iv: 'iv', wrap_iv: 'wiv', wrapped_key: 'wk', created_at: new Date().toISOString() } as any);
    vi.spyOn(files, 'recordScan').mockResolvedValue();
    vi.spyOn(files, 'recordClassification').mockResolvedValue();
    vi.spyOn(ai, 'classifyText').mockResolvedValue({ label: 'assignment', confidence: 0.88 } as any);

    const res = await handleUpload({ userId: 1, filename: 'doc.txt', mimeType: 'text/plain', buffer: Buffer.from('hi'), iv: 'iv', wrapIv: 'wiv', wrappedKey: 'wk', textPreview: 'hello', fileType: 'text' });
    expect(res.file.id).toBe(5);
    expect(res.classification?.label).toBe('assignment');
  });
});
