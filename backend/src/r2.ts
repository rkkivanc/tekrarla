import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

function getR2Client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 configuration is incomplete');
  }
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    forcePathStyle: false,
    requestHandler: {
      requestTimeout: 30000,
    },
  });
}

export async function uploadFile(
  buffer: Buffer,
  filename: string,
  mimetype: string
): Promise<string> {
  const bucket = process.env.R2_BUCKET_NAME;
  const publicUrlBase = process.env.R2_PUBLIC_URL;
  if (!bucket || !publicUrlBase) {
    throw new Error('R2_BUCKET_NAME or R2_PUBLIC_URL is not configured');
  }

  const key = `${randomUUID()}-${path.basename(filename)}`;
  const client = getR2Client();

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: mimetype,
    })
  );

  const base = publicUrlBase.replace(/\/$/, '');
  return `${base}/${encodeURI(key)}`;
}

export async function getFile(
  key: string
): Promise<{ body: Readable; contentType: string }> {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) {
    throw new Error('R2_BUCKET_NAME is not configured');
  }

  const client = getR2Client();
  const out = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );

  const body = out.Body;
  if (!body) {
    throw new Error('Empty object body');
  }

  return {
    body: body as Readable,
    contentType: out.ContentType ?? 'application/octet-stream',
  };
}
