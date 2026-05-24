import { FileObjectStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { createPresignedPutUrl, deleteObject, getObjectBuffer, putObjectBuffer } from '@/lib/r2';
import { encryptForStorage } from '@/lib/storage-crypto';
import {
  classifyImage,
  classifyText,
  extractTextPreview,
  isTextLikeMime,
  scanMalware
} from '@/lib/scan-service';
import type { FiletypeResult } from '@/lib/scan-service';
import { getAllowedMimeTypes, getMaxUploadBytes, shouldRescanOnDownload } from '@/lib/upload-config';

function safeFilename(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 140) || 'file.bin';
}

function makeTempKey(ownerId: string, fileId: string, filename: string) {
  return `temp/${ownerId}/${fileId}/${safeFilename(filename)}`;
}

function makeFinalKey(ownerId: string, fileId: string) {
  return `files/${ownerId}/${fileId}`;
}

function toStatus(value: string) {
  return value as FileObjectStatus;
}

function displayLabel(value: string | null | undefined, fallback: string) {
  return value && value.trim() ? value : fallback;
}

function imageFiletypeLabel(filetype: FiletypeResult | undefined) {
  if (!filetype?.available) return 'image';
  return displayLabel(filetype.predicted_type, 'uncertain');
}

export async function createUploadTicket(input: {
  ownerId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}) {
  const maxBytes = getMaxUploadBytes();
  if (input.sizeBytes > maxBytes) {
    throw new Error(`File exceeds MAX_UPLOAD_BYTES (${maxBytes})`);
  }

  const allowed = getAllowedMimeTypes();
  if (!allowed.includes(input.mimeType)) {
    throw new Error(`MIME type not allowed: ${input.mimeType}`);
  }

  const record = await prisma.fileObject.create({
    data: {
      ownerId: input.ownerId,
      filename: input.filename,
      mimeType: input.mimeType,
      sizeBytes: BigInt(input.sizeBytes),
      status: toStatus('PENDING')
    }
  });

  const tempKey = makeTempKey(input.ownerId, record.id, input.filename);
  await prisma.fileObject.update({
    where: { id: record.id },
    data: { tempKey }
  });

  const presignedPutUrl = await createPresignedPutUrl(tempKey, input.mimeType);
  return { fileId: record.id, tempKey, presignedPutUrl };
}

export async function finalizeUpload(input: {
  ownerId: string;
  fileId: string;
  tempKey: string;
}) {
  const file = await prisma.fileObject.findUnique({ where: { id: input.fileId } });
  if (!file || file.ownerId !== input.ownerId) {
    throw new Error('File not found');
  }

  if (file.status === toStatus('READY') && file.storageKey) {
    return {
      ok: true,
      fileId: file.id,
      status: file.status,
      scan: {
        is_malicious: file.scanIsMalicious,
        score: file.scanScore,
        model_version: file.scanModelVersion
      },
      classification: {
        label: file.categoryLabel,
        confidence: file.categoryConfidence
      }
    };
  }

  if (file.tempKey && file.tempKey !== input.tempKey) {
    throw new Error('Temp key mismatch');
  }

  const plaintext = await getObjectBuffer(input.tempKey);
  try {
    const scan = await scanMalware(plaintext);
    const scanScores = [
      scan.score,
      scan.document_ai?.score,
      scan.image_ai?.score,
      scan.url_ai?.max_malware_score
    ].filter((score): score is number => typeof score === 'number' && Number.isFinite(score));
    const effectiveScanScore = scanScores.length > 0 ? Math.max(...scanScores) : null;
    console.info('AI malware scan completed', {
      fileId: file.id,
      filename: file.filename,
      verdict: scan.verdict,
      applicable: scan.applicable,
      isMalicious: scan.is_malicious,
      score: effectiveScanScore,
      malconvScore: scan.score,
      urlAiScore: scan.url_ai?.max_malware_score ?? null,
      urlAiThreshold: scan.url_ai?.threshold ?? null,
      documentAiScore: scan.document_ai?.score ?? null,
      documentAiFeatures: scan.document_ai?.features?.map((feature) => feature.label) ?? [],
      imageAiScore: scan.image_ai?.score ?? null,
      imageAiFeatures: scan.image_ai?.features?.map((feature) => feature.label) ?? [],
      modelVersion: scan.model_version
    });
    await prisma.scanResult.create({
      data: {
        fileObjectId: file.id,
        isMalicious: scan.is_malicious,
        score: effectiveScanScore,
        modelVersion: scan.model_version
      }
    });

    if (scan.is_malicious) {
      await prisma.fileObject.update({
        where: { id: file.id },
        data: {
          status: toStatus('QUARANTINED'),
          scanIsMalicious: true,
          scanScore: effectiveScanScore,
          scanModelVersion: scan.model_version
        }
      });
      await deleteObject(input.tempKey);
      return {
        ok: false,
        status: 'QUARANTINED',
        message: 'Malicious file detected and quarantined.',
        scan
      };
    }

    let categoryLabel = 'document';
    let categoryConfidence = 0;
    let classificationMetadata: Record<string, unknown> | null = null;
    if (file.mimeType.startsWith('image/')) {
      const imageClassification = await classifyImage(plaintext);
      const filetype = imageClassification.filetype;
      const customLabel = imageFiletypeLabel(filetype);
      const customConfidence = typeof filetype?.confidence === 'number' ? filetype.confidence : 0;

      categoryLabel = customLabel;
      categoryConfidence = customConfidence;
      classificationMetadata = {
        filetype,
        imagenet: {
          label: imageClassification.label,
          confidence: imageClassification.confidence,
          model_version: imageClassification.model_version,
          displayed: true
        }
      };

      console.info('AI image classification display decision', {
        fileId: file.id,
        filename: file.filename,
        customPredictedType: filetype?.predicted_type,
        customRawPredictedType: filetype?.raw_predicted_type,
        customConfidence,
        customUncertain: filetype?.uncertain,
        oldImageNetLabel: imageClassification.label,
        oldImageNetConfidence: imageClassification.confidence,
        oldImageNetDisplayed: true,
        oldImageNetModelVersion: imageClassification.model_version
      });

      const classificationRows = [];
      if (filetype?.available) {
        classificationRows.push({
          fileObjectId: file.id,
          classifier: 'filetype',
          label: customLabel,
          confidence: customConfidence
        });
      }
      classificationRows.push({
        fileObjectId: file.id,
        classifier: 'imagenet',
        label: imageClassification.label,
        confidence: imageClassification.confidence
      });
      await prisma.classificationResult.createMany({ data: classificationRows });
    } else if (isTextLikeMime(file.mimeType)) {
      const preview = extractTextPreview(file.mimeType, plaintext);
      if (preview) {
        const category = await classifyText(preview);
        console.info('AI text classification completed', {
          fileId: file.id,
          filename: file.filename,
          label: category.label,
          confidence: category.confidence,
          modelVersion: category.model_version,
          previewChars: preview.length
        });
        categoryLabel = category.label;
        categoryConfidence = category.confidence;
        await prisma.classificationResult.create({
          data: {
            fileObjectId: file.id,
            classifier: 'text',
            label: categoryLabel,
            confidence: categoryConfidence
          }
        });
      } else {
        console.info('AI text classification skipped: no readable text preview', {
          fileId: file.id,
          filename: file.filename,
          mimeType: file.mimeType
        });
        categoryLabel = 'document';
        categoryConfidence = 0;
      }
    } else {
      const category = await classifyText('Binary document for secure file sharing.');
      console.info('AI fallback text classification completed', {
        fileId: file.id,
        filename: file.filename,
        label: category.label,
        confidence: category.confidence,
        modelVersion: category.model_version
      });
      categoryLabel = category.label || 'document';
      categoryConfidence = category.confidence || 0;
      await prisma.classificationResult.create({
        data: {
          fileObjectId: file.id,
          classifier: 'text',
          label: categoryLabel,
          confidence: categoryConfidence
        }
      });
    }

    const encrypted = encryptForStorage(plaintext);
    const finalKey = makeFinalKey(file.ownerId, file.id);
    await putObjectBuffer(finalKey, encrypted.ciphertext, 'application/octet-stream');
    await deleteObject(input.tempKey);

    const updated = await prisma.fileObject.update({
      where: { id: file.id },
      data: {
        status: toStatus('READY'),
        tempKey: null,
        storageKey: finalKey,
        scanIsMalicious: false,
        scanScore: effectiveScanScore,
        scanModelVersion: scan.model_version,
        categoryLabel,
        categoryConfidence,
        encAlgo: encrypted.encAlgo,
        encIvBase64: encrypted.encIvBase64,
        encTagBase64: encrypted.encTagBase64,
        encKeyId: encrypted.encKeyId,
        encDekBase64: encrypted.encDekBase64
      }
    });

    return {
      ok: true,
      fileId: updated.id,
      status: updated.status,
      scan,
      classification: {
        label: updated.categoryLabel,
        confidence: updated.categoryConfidence,
        ...(classificationMetadata || {})
      },
      metadata: classificationMetadata || undefined
    };
  } catch (error) {
    await prisma.fileObject.update({
      where: { id: file.id },
      data: { status: toStatus('FAILED') }
    });
    throw error;
  }
}

export async function listReadyFiles(ownerId: string) {
  const numericOwnerId = Number(ownerId);
  const sharedFilter = Number.isFinite(numericOwnerId)
    ? {
        permissions: {
          some: {
            recipientUserId: numericOwnerId,
            canDownload: true
          }
        }
      }
    : undefined;

  const rows = await prisma.fileObject.findMany({
    where: {
      status: toStatus('READY'),
      OR: [ { ownerId }, ...(sharedFilter ? [sharedFilter] : []) ]
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      ownerId: true,
      filename: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true,
      categoryLabel: true,
      categoryConfidence: true,
      scanScore: true,
      scanIsMalicious: true,
      scanModelVersion: true,
      status: true,
      classifications: {
        select: {
          classifier: true,
          label: true,
          confidence: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  return rows.map((row: {
    id: string;
    ownerId: string;
    filename: string;
    mimeType: string;
    sizeBytes: bigint;
    createdAt: Date;
    categoryLabel: string | null;
    categoryConfidence: number | null;
    scanScore: number | null;
    scanIsMalicious: boolean | null;
    scanModelVersion: string | null;
    status: FileObjectStatus;
    classifications: Array<{
      classifier: string;
      label: string;
      confidence: number | null;
      createdAt: Date;
    }>;
  }) => {
    const filetypeClassification = row.classifications.find((item) => item.classifier === 'filetype') || null;
    const imagenetClassification = row.classifications.find((item) => item.classifier === 'imagenet') || null;
    const textClassification = row.classifications.find((item) => item.classifier === 'text') || null;
    return {
      ...row,
      isOwner: row.ownerId === ownerId,
      sizeBytes: Number(row.sizeBytes),
      filetypeClassification,
      imagenetClassification,
      textClassification
    };
  });
}

export async function findReadyFile(ownerId: string, id: string) {
  return prisma.fileObject.findFirst({
    where: { id, ownerId, status: toStatus('READY') }
  });
}

export async function shareFileObject(input: {
  fileId: string;
  ownerId: string;
  recipientUserId: number;
  sharedSecret: string;
}) {
  const file = await prisma.fileObject.findFirst({
    where: { id: input.fileId, ownerId: input.ownerId, status: toStatus('READY') }
  });
  if (!file) {
    throw new Error('File not found');
  }

  const secretHash = await bcrypt.hash(input.sharedSecret, 10);
  return prisma.fileObjectPermission.upsert({
    where: {
      fileObjectId_recipientUserId: {
        fileObjectId: input.fileId,
        recipientUserId: input.recipientUserId
      }
    },
    create: {
      fileObjectId: input.fileId,
      recipientUserId: input.recipientUserId,
      secretHash,
      canDownload: true
    },
    update: {
      secretHash,
      canDownload: true
    }
  });
}

export async function findFileForDownload(input: {
  fileId: string;
  requesterId: string;
}) {
  const file = await prisma.fileObject.findFirst({
    where: { id: input.fileId, status: toStatus('READY') }
  });
  if (!file) return null;

  const isOwner = file.ownerId === input.requesterId;
  if (isOwner) {
    return { file, isOwner: true as const, permission: null };
  }

  const requesterNumericId = Number(input.requesterId);
  if (!Number.isFinite(requesterNumericId)) {
    return null;
  }

  const permission = await prisma.fileObjectPermission.findFirst({
    where: {
      fileObjectId: file.id,
      recipientUserId: requesterNumericId,
      canDownload: true
    }
  });

  if (!permission) return null;
  return { file, isOwner: false as const, permission };
}

export async function verifySharedSecret(secret: string, secretHash: string) {
  return bcrypt.compare(secret, secretHash);
}

export async function deleteFileObject(ownerId: string, id: string) {
  const record = await prisma.fileObject.findFirst({ where: { id, ownerId } });
  if (!record) {
    throw new Error('Not found');
  }

  if (record.storageKey) {
    await deleteObject(record.storageKey).catch(() => null);
  }
  if (record.tempKey) {
    await deleteObject(record.tempKey).catch(() => null);
  }
  await prisma.fileObject.delete({ where: { id: record.id } });
}

export async function maybeRescanOnDownload(content: Buffer) {
  if (!shouldRescanOnDownload()) return null;

  const timeoutMs = 4000;
  const scanPromise = scanMalware(content);
  const timeoutPromise = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), timeoutMs)
  );
  return Promise.race([scanPromise, timeoutPromise]);
}
