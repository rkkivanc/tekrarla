import { Router } from 'express';
import multer from 'multer';
import { GetObjectCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { Readable } from 'node:stream';
import { uploadFile } from '../r2.js';
import { requireAuth, requirePasswordChanged } from '../middleware/auth.js';

const router = Router();

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

function resolveContentType(headContentType: string | undefined): string {
  const t = headContentType?.trim();
  if (t) return t;
  return 'audio/webm';
}

type RangeParse = { start: number; end: number } | 'unsatisfiable' | null;

function parseBytesRange(rangeHeader: string | undefined, fileSize: number): RangeParse {
  if (!rangeHeader) return null;
  const trimmed = rangeHeader.trim();
  const m = /^bytes=(\d*)-(\d*)$/i.exec(trimmed);
  if (!m) return null;
  const startStr = m[1];
  const endStr = m[2];
  if (startStr === '' && endStr === '') return null;

  if (fileSize < 0) return 'unsatisfiable';
  if (fileSize === 0) {
    if (startStr !== '' || endStr !== '') return 'unsatisfiable';
    return null;
  }

  if (startStr === '' && endStr !== '') {
    const suffix = Number(endStr);
    if (!Number.isFinite(suffix) || suffix < 1) return 'unsatisfiable';
    const start = Math.max(0, fileSize - suffix);
    const end = fileSize - 1;
    return { start, end };
  }

  if (startStr !== '' && endStr === '') {
    const start = Number(startStr);
    if (!Number.isFinite(start) || start < 0) return 'unsatisfiable';
    if (start >= fileSize) return 'unsatisfiable';
    return { start, end: fileSize - 1 };
  }

  const start = Number(startStr);
  const end = Number(endStr);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start) return 'unsatisfiable';
  if (start >= fileSize) return 'unsatisfiable';
  const clampedEnd = Math.min(end, fileSize - 1);
  return { start, end: clampedEnd };
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok =
      typeof file.mimetype === 'string' &&
      (file.mimetype.startsWith('image/') || file.mimetype.startsWith('audio/'));
    if (ok) {
      cb(null, true);
      return;
    }
    cb(new Error('Only image and audio files are allowed'));
  },
});

router.get('/:key', async (req, res) => {
  const { key } = req.params;
  if (!key) {
    res.status(400).json({ error: 'key is required' });
    return;
  }

  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) {
    res.status(500).json({ error: 'Storage not configured' });
    return;
  }

  const decodedKey = decodeURIComponent(key);

  try {
    const client = getR2Client();
    const headOut = await client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: decodedKey,
      })
    );

    const fileSize = headOut.ContentLength ?? 0;
    const contentType = resolveContentType(headOut.ContentType);

    res.setHeader('Accept-Ranges', 'bytes');

    const rangeResult = parseBytesRange(req.headers.range, fileSize);

    if (rangeResult === 'unsatisfiable') {
      res.status(416);
      res.setHeader('Content-Range', `bytes */${fileSize}`);
      res.setHeader('Content-Type', contentType);
      res.end();
      return;
    }

    if (rangeResult === null) {
      const obj = await client.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: decodedKey,
        })
      );
      const body = obj.Body as Readable | undefined;
      if (!body) {
        res.status(500).json({ error: 'Empty body' });
        return;
      }

      res.status(200);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', String(fileSize));

      body.on('error', err => {
        console.error(err);
        if (!res.headersSent) {
          res.status(500).end();
        } else {
          res.destroy(err);
        }
      });
      body.pipe(res);
      return;
    }

    const { start, end } = rangeResult;
    const chunkSize = end - start + 1;

    const obj = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: decodedKey,
        Range: `bytes=${start}-${end}`,
      })
    );
    const body = obj.Body as Readable | undefined;
    if (!body) {
      res.status(500).json({ error: 'Empty body' });
      return;
    }

    res.status(206);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', String(chunkSize));
    res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);

    body.on('error', err => {
      console.error(err);
      if (!res.headersSent) {
        res.status(500).end();
      } else {
        res.destroy(err);
      }
    });
    body.pipe(res);
  } catch (err: unknown) {
    const name = err && typeof err === 'object' && 'name' in err ? (err as { name: string }).name : '';
    if (name === 'NoSuchKey' || name === 'NotFound') {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to get file' });
  }
});

router.post('/', requireAuth, requirePasswordChanged, (req, res, next) => {
  upload.single('file')(req, res, err => {
    if (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Upload rejected' });
      return;
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }
    const url = await uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype);
    res.json({ url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

export default router;
