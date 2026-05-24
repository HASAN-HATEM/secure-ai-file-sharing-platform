import { scanMalware, classifyText, classifyImage } from './aiClient';
import { saveFile, recordScan, recordClassification } from './files';
import { logAudit } from './audit';

export async function handleUpload(opts: {
  userId: number;
  filename: string;
  mimeType: string;
  buffer: Buffer;
  iv: string;
  wrapIv: string;
  wrappedKey: string;
  textPreview?: string;
  fileType?: string;
}) {
  const scan = await scanMalware(opts.buffer);
  await logAudit(opts.userId, 'SCAN', 'file', null, { filename: opts.filename, scan });
  if (scan.is_malicious) {
    throw new Error('Malicious file blocked');
  }
  const saved = await saveFile({
    ownerId: opts.userId,
    filename: opts.filename,
    mimeType: opts.mimeType,
    sizeBytes: opts.buffer.length,
    encryptedBlob: opts.buffer,
    iv: opts.iv,
    wrapIv: opts.wrapIv,
    wrappedKey: opts.wrappedKey
  });
  await recordScan(saved.id, false, scan.score, scan.model_version);

  let classification: { label: string; confidence: number; classifier_type: string } | null = null;
  if ((opts.fileType === 'text' || opts.mimeType.startsWith('text/')) && opts.textPreview) {
    const cls = await classifyText(opts.textPreview.slice(0, 4000));
    await recordClassification(saved.id, 'BERT', cls.label, cls.confidence);
    classification = { ...cls, classifier_type: 'BERT' };
  } else if (opts.mimeType.startsWith('image/')) {
    const cls = await classifyImage(opts.buffer);
    await recordClassification(saved.id, 'RESNET', cls.label, cls.confidence);
    classification = { ...cls, classifier_type: 'RESNET' };
  }

  return { file: saved, scan, classification };
}
