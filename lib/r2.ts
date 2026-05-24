import { Readable } from 'stream';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

function required(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function getClient() {
  return new S3Client({
    region: process.env.S3_REGION || 'auto',
    endpoint: required('S3_ENDPOINT'),
    credentials: {
      accessKeyId: required('S3_ACCESS_KEY_ID'),
      secretAccessKey: required('S3_SECRET_ACCESS_KEY')
    },
    forcePathStyle: true
  });
}

export function getBucketName() {
  return required('S3_BUCKET');
}

export async function createPresignedPutUrl(key: string, contentType: string) {
  const client = getClient();
  const command = new PutObjectCommand({
    Bucket: getBucketName(),
    Key: key,
    ContentType: contentType
  });
  return getSignedUrl(client, command, { expiresIn: 900 });
}

export async function getObjectBuffer(key: string) {
  const client = getClient();
  const output = await client.send(
    new GetObjectCommand({
      Bucket: getBucketName(),
      Key: key
    })
  );

  if (!output.Body) {
    throw new Error('R2 object body is empty');
  }

  return streamToBuffer(output.Body as any);
}

export async function putObjectBuffer(key: string, body: Buffer, contentType: string) {
  const client = getClient();
  await client.send(
    new PutObjectCommand({
      Bucket: getBucketName(),
      Key: key,
      Body: body,
      ContentType: contentType
    })
  );
}

export async function deleteObject(key: string) {
  const client = getClient();
  await client.send(
    new DeleteObjectCommand({
      Bucket: getBucketName(),
      Key: key
    })
  );
}

export async function getObjectStream(key: string): Promise<Readable> {
  const client = getClient();
  const output = await client.send(
    new GetObjectCommand({
      Bucket: getBucketName(),
      Key: key
    })
  );

  const body = output.Body;
  if (!body) {
    throw new Error('R2 object body is empty');
  }
  if (body instanceof Readable) {
    return body;
  }
  return Readable.fromWeb(body as any);
}

async function streamToBuffer(
  body: Readable | ReadableStream<Uint8Array> | Blob
): Promise<Buffer> {
  if (body instanceof Readable) {
    const chunks: Buffer[] = [];
    for await (const chunk of body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  if (typeof Blob !== 'undefined' && body instanceof Blob) {
    const ab = await body.arrayBuffer();
    return Buffer.from(ab);
  }

  const reader = (body as ReadableStream<Uint8Array>).getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
}
