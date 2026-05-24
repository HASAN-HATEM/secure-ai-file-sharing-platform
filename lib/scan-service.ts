const SCANNER_BASE_URL =
  process.env.SCANNER_SERVICE_URL ||
  process.env.AI_SERVICE_URL ||
  'http://ai:8000';

export type MalwareScanResult = {
  verdict?: string;
  is_malicious: boolean;
  score: number | null;
  confidence?: number | null;
  model_version: string;
  applicable?: boolean;
  url_ai?: {
    available: boolean;
    model_version: string | null;
    urls_found: number;
    ignored_metadata_urls?: number;
    scanned: number;
    is_malicious: boolean;
    max_malware_score: number | null;
    threshold?: number;
    results: Array<{
      url: string;
      label: string;
      malware_score: number;
      benign_score: number;
    }>;
    error?: string;
  };
  document_ai?: {
    available: boolean;
    model_version: string | null;
    file_kind: string;
    is_malicious: boolean;
    score: number | null;
    features: Array<{
      label: string;
      weight: number;
      count: number;
    }>;
  };
  image_ai?: {
    available: boolean;
    model_version: string | null;
    applicable: boolean;
    image_format: string | null;
    dimensions: number[] | null;
    is_malicious: boolean;
    score: number | null;
    features: Array<{
      label: string;
      weight: number;
      count: number;
    }>;
  };
};

export type CategorizationResult = {
  label: string;
  confidence: number;
  model_version?: string;
  filetype?: FiletypeResult;
};

export type FiletypeResult = {
  available: boolean;
  predicted_type: string | null;
  raw_predicted_type?: string | null;
  confidence: number | null;
  top_3_predictions: Array<{ type: string; confidence: number }>;
  uncertain: boolean;
  threshold?: number;
  model_version?: string | null;
  error?: string;
};

function asBody(buffer: Buffer) {
  return new Uint8Array(buffer);
}

export async function scanMalware(buffer: Buffer): Promise<MalwareScanResult> {
  const res = await fetch(`${SCANNER_BASE_URL}/scan/malware`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: asBody(buffer)
  });
  if (!res.ok) {
    throw new Error(`Malware scan failed with ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  return {
    verdict: typeof data?.verdict === 'string' ? data.verdict : undefined,
    is_malicious: Boolean(data?.is_malicious),
    score: data?.score === null || data?.score === undefined ? null : Number(data.score),
    confidence: data?.confidence === null || data?.confidence === undefined ? null : Number(data.confidence),
    model_version: String(data?.model_version || 'unknown'),
    applicable: typeof data?.applicable === 'boolean' ? data.applicable : undefined,
    url_ai: data?.url_ai
      ? {
          available: Boolean(data.url_ai.available),
          model_version: data.url_ai.model_version === null || data.url_ai.model_version === undefined
            ? null
            : String(data.url_ai.model_version),
          urls_found: Number(data.url_ai.urls_found || 0),
          ignored_metadata_urls: data.url_ai.ignored_metadata_urls === null || data.url_ai.ignored_metadata_urls === undefined
            ? undefined
            : Number(data.url_ai.ignored_metadata_urls),
          scanned: Number(data.url_ai.scanned || 0),
          is_malicious: Boolean(data.url_ai.is_malicious),
          max_malware_score: data.url_ai.max_malware_score === null || data.url_ai.max_malware_score === undefined
            ? null
            : Number(data.url_ai.max_malware_score),
          threshold: data.url_ai.threshold === null || data.url_ai.threshold === undefined
            ? undefined
            : Number(data.url_ai.threshold),
          results: Array.isArray(data.url_ai.results)
            ? data.url_ai.results.map((item: any) => ({
                url: String(item?.url || ''),
                label: String(item?.label || ''),
                malware_score: Number(item?.malware_score || 0),
                benign_score: Number(item?.benign_score || 0)
              }))
            : [],
          error: data.url_ai.error ? String(data.url_ai.error) : undefined
        }
      : undefined,
    document_ai: data?.document_ai
      ? {
          available: Boolean(data.document_ai.available),
          model_version: data.document_ai.model_version === null || data.document_ai.model_version === undefined
            ? null
            : String(data.document_ai.model_version),
          file_kind: String(data.document_ai.file_kind || 'other'),
          is_malicious: Boolean(data.document_ai.is_malicious),
          score: data.document_ai.score === null || data.document_ai.score === undefined
            ? null
            : Number(data.document_ai.score),
          features: Array.isArray(data.document_ai.features)
            ? data.document_ai.features.map((item: any) => ({
                label: String(item?.label || ''),
                weight: Number(item?.weight || 0),
                count: Number(item?.count || 0)
              }))
            : []
        }
      : undefined,
    image_ai: data?.image_ai
      ? {
          available: Boolean(data.image_ai.available),
          model_version: data.image_ai.model_version === null || data.image_ai.model_version === undefined
            ? null
            : String(data.image_ai.model_version),
          applicable: Boolean(data.image_ai.applicable),
          image_format: data.image_ai.image_format === null || data.image_ai.image_format === undefined
            ? null
            : String(data.image_ai.image_format),
          dimensions: Array.isArray(data.image_ai.dimensions)
            ? data.image_ai.dimensions.map((value: any) => Number(value))
            : null,
          is_malicious: Boolean(data.image_ai.is_malicious),
          score: data.image_ai.score === null || data.image_ai.score === undefined
            ? null
            : Number(data.image_ai.score),
          features: Array.isArray(data.image_ai.features)
            ? data.image_ai.features.map((item: any) => ({
                label: String(item?.label || ''),
                weight: Number(item?.weight || 0),
                count: Number(item?.count || 0)
              }))
            : []
        }
      : undefined
  };
}

export async function classifyImage(buffer: Buffer): Promise<CategorizationResult> {
  const res = await fetch(`${SCANNER_BASE_URL}/classify/image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: asBody(buffer)
  });
  if (!res.ok) {
    throw new Error(`Image classification failed with ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  const filetype = data?.filetype;
  return {
    label: String(data?.label || 'image'),
    confidence: Number(data?.confidence || 0),
    model_version: data?.model_version ? String(data.model_version) : undefined,
    filetype: filetype
      ? {
          available: Boolean(filetype.available),
          predicted_type: filetype.predicted_type === null || filetype.predicted_type === undefined
            ? null
            : String(filetype.predicted_type),
          raw_predicted_type: filetype.raw_predicted_type === null || filetype.raw_predicted_type === undefined
            ? null
            : String(filetype.raw_predicted_type),
          confidence: filetype.confidence === null || filetype.confidence === undefined
            ? null
            : Number(filetype.confidence),
          top_3_predictions: Array.isArray(filetype.top_3_predictions)
            ? filetype.top_3_predictions.map((item: any) => ({
                type: String(item?.type || ''),
                confidence: Number(item?.confidence || 0)
              }))
            : [],
          uncertain: Boolean(filetype.uncertain),
          threshold: filetype.threshold === null || filetype.threshold === undefined
            ? undefined
            : Number(filetype.threshold),
          model_version: filetype.model_version === null || filetype.model_version === undefined
            ? null
            : String(filetype.model_version),
          error: filetype.error ? String(filetype.error) : undefined
        }
      : undefined
  };
}

export async function classifyText(text: string): Promise<CategorizationResult> {
  const res = await fetch(`${SCANNER_BASE_URL}/classify/text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });
  if (!res.ok) {
    throw new Error(`Text classification failed with ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  return {
    label: String(data?.label || 'document'),
    confidence: Number(data?.confidence || 0),
    model_version: data?.model_version ? String(data.model_version) : undefined
  };
}

export function isTextLikeMime(mimeType: string) {
  if (mimeType.startsWith('text/')) return true;
  const textLike = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  return textLike.includes(mimeType);
}

export function extractTextPreview(mimeType: string, buffer: Buffer): string | null {
  if (mimeType.startsWith('text/')) {
    return normalizeTextPreview(buffer.toString('utf8', 0, Math.min(buffer.length, 4000)));
  }
  if (mimeType === 'application/pdf') {
    return extractPdfTextPreview(buffer);
  }
  return null;
}

function normalizeTextPreview(text: string) {
  const normalized = text
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N}\p{P}\p{Zs}]/gu, ' ')
    .trim();
  const letters = Array.from(normalized).filter((char) => /\p{L}/u.test(char)).length;
  if (letters < 30) return null;
  return normalized.slice(0, 4000);
}

function extractPdfTextPreview(buffer: Buffer) {
  const raw = buffer.toString('latin1', 0, Math.min(buffer.length, 1_000_000));
  const strings = Array.from(raw.matchAll(/\(([^()]{8,500})\)/g))
    .map((match) => match[1].replace(/\\[()\\]/g, ' '))
    .filter((value) => !/^[A-Z]{1,12}$/.test(value.trim()));
  return normalizeTextPreview(strings.join(' '));
}
