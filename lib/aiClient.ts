const AI_URL =
  process.env.SCANNER_SERVICE_URL ||
  process.env.AI_SERVICE_URL ||
  "http://ai:8000";

type MalwareResponse = {
  verdict?: "clean" | "malicious";
  is_malicious: boolean;
  score: number;
  confidence?: number;
  model_version: string;
};

type ClassifyResponse = {
  label: string;
  confidence: number;
  model_version?: string;
};

/**
 * Convert any supported binary input into a REAL ArrayBuffer
 * (never SharedArrayBuffer / ArrayBufferLike)
 */
function toBody(
  blob: Buffer | Uint8Array | ArrayBuffer | SharedArrayBuffer
): ArrayBuffer {
  let view: Uint8Array;

  if (Buffer.isBuffer(blob)) {
    view = new Uint8Array(blob.buffer, blob.byteOffset, blob.byteLength);
  } else if (blob instanceof Uint8Array) {
    view = blob;
  } else if (blob instanceof ArrayBuffer) {
    view = new Uint8Array(blob);
  } else {
    // SharedArrayBuffer
    view = new Uint8Array(blob);
  }

  // Allocate a REAL ArrayBuffer and copy bytes
  const ab = new ArrayBuffer(view.byteLength);
  new Uint8Array(ab).set(view);
  return ab;
}

export async function scanMalware(
  blob: Buffer | Uint8Array | ArrayBuffer
): Promise<MalwareResponse> {
  const res = await fetch(`${AI_URL}/scan/malware`, {
    method: "POST",
    body: toBody(blob),
    headers: { "Content-Type": "application/octet-stream" },
  });

  if (!res.ok) throw new Error("AI scan failed");
  return res.json();
}

export async function classifyText(text: string): Promise<ClassifyResponse> {
  // Prefer new endpoint
  let res = await fetch(`${AI_URL}/categorize/text`, {
    method: "POST",
    body: JSON.stringify({ text }),
    headers: { "Content-Type": "application/json" },
  });

  if (res.ok) return res.json();

  // Fallback for legacy endpoint
  res = await fetch(`${AI_URL}/classify/text`, {
    method: "POST",
    body: JSON.stringify({ text }),
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) throw new Error("Text classification failed");
  return res.json();
}

export async function classifyImage(
  blob: Buffer | Uint8Array | ArrayBuffer
): Promise<ClassifyResponse> {
  // Prefer new endpoint
  let res = await fetch(`${AI_URL}/categorize/image`, {
    method: "POST",
    body: toBody(blob),
    headers: { "Content-Type": "application/octet-stream" },
  });

  if (res.ok) return res.json();

  // Fallback for legacy endpoint
  res = await fetch(`${AI_URL}/classify/image`, {
    method: "POST",
    body: toBody(blob),
    headers: { "Content-Type": "application/octet-stream" },
  });

  if (!res.ok) throw new Error("Image classification failed");
  return res.json();
}