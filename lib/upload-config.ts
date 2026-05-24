const DEFAULT_MAX_UPLOAD_BYTES = 26_214_400;
const DEFAULT_ALLOWED_MIME = [
  'application/octet-stream',
  'application/x-msdownload',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-word.document.macroEnabled.12',
  'application/vnd.ms-excel.sheet.macroEnabled.12',
  'application/vnd.ms-powerpoint.presentation.macroEnabled.12',
  'text/plain',
  'image/png',
  'image/jpeg'
];

export function getMaxUploadBytes() {
  const raw = process.env.MAX_UPLOAD_BYTES;
  const parsed = raw ? Number(raw) : DEFAULT_MAX_UPLOAD_BYTES;
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_MAX_UPLOAD_BYTES;
  return parsed;
}

export function getAllowedMimeTypes() {
  const raw = process.env.ALLOWED_MIME;
  if (!raw) return DEFAULT_ALLOWED_MIME;
  const parsed = raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return parsed.length ? parsed : DEFAULT_ALLOWED_MIME;
}

export function isMimeAllowed(mimeType: string) {
  const allowed = getAllowedMimeTypes();
  return allowed.includes(mimeType);
}

export function shouldRescanOnDownload() {
  return String(process.env.RESCAN_ON_DOWNLOAD || 'false').toLowerCase() === 'true';
}
