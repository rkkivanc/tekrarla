import { Router } from 'express';
import multer from 'multer';
import { getFile, uploadFile } from '../r2.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.get('/:key', async (req, res) => {
  const { key } = req.params;
  if (!key) {
    res.status(400).json({ error: 'key is required' });
    return;
  }

  try {
    const { body, contentType } = await getFile(decodeURIComponent(key));
    res.setHeader('Content-Type', contentType);
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
    if (name === 'NoSuchKey') {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to get file' });
  }
});

router.post('/', requireAuth, upload.single('file'), async (req, res) => {
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
