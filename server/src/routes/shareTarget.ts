import { Router } from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';

const shareUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 40 * 1024 * 1024 },
});

type PendingShare = {
  buffer: Buffer;
  mimeType: string;
  filename: string;
  title: string;
  text: string;
  url: string;
  expiresAt: number;
};

const pending = new Map<string, PendingShare>();
const TTL_MS = 5 * 60 * 1000;

function pruneExpired() {
  const now = Date.now();
  for (const [id, item] of pending) {
    if (item.expiresAt <= now) pending.delete(id);
  }
}

setInterval(pruneExpired, 60_000).unref?.();

export const shareTargetRouter = Router();

/**
 * Web Share Target receiver (Android PWA).
 * Accepts multipart from the OS share sheet, stores briefly, redirects to the app.
 */
shareTargetRouter.post('/', shareUpload.any(), (req, res) => {
  pruneExpired();

  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  const image =
    files.find((f) => f.fieldname === 'media' && f.mimetype.startsWith('image/')) ||
    files.find((f) => f.mimetype.startsWith('image/')) ||
    files.find((f) => f.fieldname === 'media' || f.fieldname === 'file') ||
    files[0];

  const title = String(req.body?.title ?? '');
  const text = String(req.body?.text ?? '');
  const sharedUrl = String(req.body?.url ?? '');

  const id = randomUUID();
  pending.set(id, {
    buffer: image?.buffer ?? Buffer.alloc(0),
    mimeType: image?.mimetype || 'application/octet-stream',
    filename: image?.originalname || 'shared.jpg',
    title,
    text,
    url: sharedUrl,
    expiresAt: Date.now() + TTL_MS,
  });

  // Relative Location → same host as the PWA (works behind nginx / Vite proxy)
  res.redirect(303, `/?share-target=1&sid=${encodeURIComponent(id)}`);
});

/** One-time consume of a pending shared payload (no auth — short-lived secret id). */
shareTargetRouter.get('/:id', (req, res) => {
  pruneExpired();
  const id = req.params.id;
  const item = pending.get(id);
  if (!item || item.expiresAt <= Date.now()) {
    pending.delete(id);
    res.status(404).json({ error: 'Share expired or not found' });
    return;
  }
  pending.delete(id);

  const hasFile = item.buffer.length > 0;
  res.json({
    title: item.title,
    text: item.text,
    url: item.url,
    hasFile,
    file: hasFile
      ? {
          base64: item.buffer.toString('base64'),
          mimeType: item.mimeType,
          filename: item.filename,
        }
      : null,
  });
});
