import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { serializeCard, listSerializedCards } from '../lib/serialize.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { getStorageForUser, resolveFileBuffer } from '../storage/index.js';
import { googleStorage, refreshDriveThumbnail } from '../storage/google.js';
import { toDbFileSize } from '../lib/fileSize.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 40 * 1024 * 1024 },
});

const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 50 },
});

export const cardsRouter = Router();
cardsRouter.use(requireAuth);

const placementSchema = z.object({
  itemId: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  rotation: z.number().optional(),
  zIndex: z.number().optional(),
});

function parseImageDataUrl(dataUrl: string): { mime: string; buffer: Buffer } | null {
  const marker = ';base64,';
  if (!dataUrl.startsWith('data:image/') || !dataUrl.includes(marker)) return null;
  const idx = dataUrl.indexOf(marker);
  const mime = dataUrl.slice('data:'.length, idx);
  if (!/^image\/[a-zA-Z0-9.+-]+$/.test(mime)) return null;
  try {
    return { mime, buffer: Buffer.from(dataUrl.slice(idx + marker.length), 'base64') };
  } catch {
    return null;
  }
}

async function upsertCardDrawing(cardId: string, buffer: Buffer, mimeType: string) {
  const existingFile = await prisma.cardFile.findUnique({ where: { cardId } });
  if (existingFile) {
    return prisma.cardFile.update({
      where: { id: existingFile.id },
      data: { drawingData: buffer, drawingMimeType: mimeType },
    });
  }
  return prisma.cardFile.create({
    data: {
      cardId,
      mimeType: 'application/octet-stream',
      filename: 'drawing.png',
      drawingData: buffer,
      drawingMimeType: mimeType,
    },
  });
}

cardsRouter.get('/', async (req: AuthRequest, res) => {
  const cards = await listSerializedCards(req.auth!.profileId);
  res.json({ cards });
});

/** Delete all cards for the current profile — DB only, never touches Google Drive. */
cardsRouter.delete('/all', async (req: AuthRequest, res) => {
  const profileId = req.auth!.profileId;
  const { count } = await prisma.card.deleteMany({ where: { profileId } });
  res.json({ ok: true, deleted: count });
});

const mymindRowSchema = z.object({
  mymindId: z.string().min(1),
  type: z.string().min(1),
  title: z.string().optional(),
  url: z.string().optional(),
  content: z.string().optional(),
  note: z.string().optional(),
  tags: z.array(z.string()).optional(),
  created: z.string().optional(),
});

/** Import a batch of MyMind cards — uses active storage (Postgres or Google upload folder). */
cardsRouter.post('/import/mymind', importUpload.any(), async (req: AuthRequest, res) => {
  try {
    const raw = req.body.manifest;
    if (!raw || typeof raw !== 'string') {
      res.status(400).json({ error: 'manifest required' });
      return;
    }
    const manifest = JSON.parse(raw) as unknown;
    const parsed = z.array(mymindRowSchema).safeParse(manifest);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const uploaded = (req.files ?? []) as Express.Multer.File[];
    const filesById = new Map<string, Express.Multer.File>();
    for (const f of uploaded) {
      const stem = f.originalname.replace(/\.[^.]+$/, '');
      filesById.set(stem, f);
    }

    const profileId = req.auth!.profileId;
    const userId = req.auth!.userId;
    const storage = await getStorageForUser(userId);

    if (storage.mode === 'google' && uploaded.length > 0) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user?.googleRefreshToken) {
        res.status(400).json({ error: 'Connect Google Drive before importing files' });
        return;
      }
      if (!user.googleUploadFolderId) {
        res.status(400).json({ error: 'Choose a Google Drive upload folder in settings first' });
        return;
      }
    }

    let imported = 0;
    let failed = 0;
    const cards: ReturnType<typeof serializeCard>[] = [];

    for (const row of parsed.data) {
      try {
        const kind = row.type;
        const kindLower = kind.toLowerCase();
        const file = filesById.get(row.mymindId);
        const tagSet = new Set([...(row.tags ?? []), 'MyMind']);
        tagSet.delete('');

        let source: 'default' | 'uploaded' | 'url' | 'note' | 'mymind' | 'drive' = 'mymind';
        if (kindLower === 'note') source = 'note';
        else if (file) source = storage.mode === 'google' ? 'drive' : 'uploaded';
        else if (row.url) source = 'url';

        let fileMeta: Awaited<ReturnType<typeof storage.storeFile>> | null = null;
        if (file) {
          fileMeta = await storage.storeFile(userId, file, {
            title: row.title?.trim() || file.originalname,
          });
        }

        const card = await prisma.card.create({
          data: {
            profileId,
            kind,
            title: row.title?.trim() || 'Sans titre',
            url: row.url || '',
            tags: Array.from(tagSet),
            source,
            markdown: kindLower === 'note' ? row.content || '' : undefined,
            additionalNotes: row.note || undefined,
            ...(row.created ? { createdAt: new Date(row.created) } : {}),
            ...(fileMeta
              ? {
                  file: {
                    create: {
                      mimeType: fileMeta.mimeType,
                      filename: fileMeta.filename,
                      data: fileMeta.data ?? null,
                      driveFileId: fileMeta.driveFileId ?? null,
                      thumbnailLink: fileMeta.thumbnailLink ?? null,
                      thumbnailData: fileMeta.thumbnailData ?? null,
                      thumbnailMime: fileMeta.thumbnailMime ?? null,
                      size: toDbFileSize(fileMeta.size),
                    },
                  },
                }
              : {}),
          },
          include: { file: true },
        });
        cards.push(serializeCard(card));
        imported++;
      } catch (err) {
        console.error('MyMind import row failed', row.mymindId, err);
        failed++;
      }
    }

    res.status(201).json({ imported, failed, cards });
  } catch (err) {
    console.error('MyMind import error', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Import failed' });
  }
});

cardsRouter.get('/:id', async (req: AuthRequest, res) => {
  const card = await prisma.card.findFirst({
    where: { id: req.params.id, profileId: req.auth!.profileId },
    include: { file: true },
  });
  if (!card) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json({ card: serializeCard(card) });
});

cardsRouter.post('/', upload.single('file'), async (req: AuthRequest, res) => {
  try {
    const body = req.body as Record<string, string>;
    const kind = body.kind || 'image';
    const title = body.title || 'Sans titre';
    const tags = body.tags ? (JSON.parse(body.tags) as string[]) : [];
    const folderId = body.folderId || null;
    const source = (body.source as 'default' | 'uploaded' | 'url' | 'note') || 'default';
    const markdown = body.markdown;
    const additionalNotes = body.additionalNotes;
    const externalUrl = body.url || '';
    const width = body.width ? Number(body.width) : undefined;
    const height = body.height ? Number(body.height) : undefined;
    const aspectRatio = body.aspectRatio ? Number(body.aspectRatio) : undefined;
    const moodboardPlacements = body.moodboardPlacements
      ? (JSON.parse(body.moodboardPlacements) as unknown)
      : undefined;

    if (folderId) {
      const folder = await prisma.folder.findFirst({
        where: { id: folderId, profileId: req.auth!.profileId },
      });
      if (!folder) {
        res.status(400).json({ error: 'Invalid folder' });
        return;
      }
    }

    const storage = await getStorageForUser(req.auth!.userId);
    let fileMeta = null as Awaited<ReturnType<typeof storage.storeFile>> | null;

    if (req.file) {
      if (storage.mode === 'google') {
        const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
        if (!user?.googleRefreshToken) {
          res.status(400).json({ error: 'Connect Google Drive first' });
          return;
        }
      }
      fileMeta = await storage.storeFile(req.auth!.userId, req.file, { title });
    }

    const card = await prisma.card.create({
      data: {
        profileId: req.auth!.profileId,
        folderId,
        kind,
        title,
        url: externalUrl,
        tags,
        source: req.file ? 'uploaded' : source,
        markdown,
        additionalNotes,
        width,
        height,
        aspectRatio,
        moodboardPlacements: moodboardPlacements as Prisma.InputJsonValue | undefined,
        ...(fileMeta
          ? {
              file: {
                create: {
                  mimeType: fileMeta.mimeType,
                  filename: fileMeta.filename,
                  data: fileMeta.data ?? null,
                  driveFileId: fileMeta.driveFileId ?? null,
                  thumbnailLink: fileMeta.thumbnailLink ?? null,
                  thumbnailData: fileMeta.thumbnailData ?? null,
                  thumbnailMime: fileMeta.thumbnailMime ?? null,
                  size: toDbFileSize(fileMeta.size),
                },
              },
            }
          : {}),
      },
      include: { file: true },
    });

    res.status(201).json({ card: serializeCard(card) });
  } catch (err) {
    console.error('Create card error', err);
    const message = err instanceof Error ? err.message : 'Create failed';
    const status = (err as { status?: number }).status ?? 500;
    res.status(status).json({ error: message });
  }
});

cardsRouter.patch('/:id', upload.single('file'), async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.card.findFirst({
      where: { id: req.params.id, profileId: req.auth!.profileId },
      include: { file: true },
    });
    if (!existing) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const body = req.body as Record<string, string>;
    const data: Prisma.CardUpdateInput = {};

    // JSON body path (application/json)
    if (req.is('application/json')) {
      const jsonSchema = z.object({
        title: z.string().optional(),
        markdown: z.string().optional(),
        additionalNotes: z.string().nullable().optional(),
        dominantColor: z.string().nullable().optional(),
        url: z.string().optional(),
        isFavorite: z.boolean().optional(),
        tags: z.array(z.string()).optional(),
        folderId: z.string().nullable().optional(),
        moodboardPlacements: placementSchema.array().optional(),
        width: z.number().optional(),
        height: z.number().optional(),
        aspectRatio: z.number().optional(),
        drawingData: z.string().nullable().optional(),
      });
      const parsed = jsonSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
      }
      const j = parsed.data;
      if (j.title !== undefined) data.title = j.title;
      if (j.markdown !== undefined) data.markdown = j.markdown;
      if (j.additionalNotes !== undefined) data.additionalNotes = j.additionalNotes;
      if (j.dominantColor !== undefined) data.dominantColor = j.dominantColor;
      if (j.url !== undefined) data.url = j.url;
      if (j.isFavorite !== undefined) data.isFavorite = j.isFavorite;
      if (j.tags !== undefined) data.tags = j.tags;
      if (j.folderId !== undefined) {
        data.folder =
          j.folderId === null ? { disconnect: true } : { connect: { id: j.folderId } };
      }
      if (j.moodboardPlacements !== undefined) {
        data.moodboardPlacements = j.moodboardPlacements;
      }
      if (j.width !== undefined) data.width = j.width;
      if (j.height !== undefined) data.height = j.height;
      if (j.aspectRatio !== undefined) data.aspectRatio = j.aspectRatio;

      if (j.drawingData !== undefined) {
        if (j.drawingData === null) {
          if (existing.file) {
            await prisma.cardFile.update({
              where: { cardId: existing.id },
              data: { drawingData: null, drawingMimeType: null },
            });
          }
        } else {
          const parsedDrawing = parseImageDataUrl(j.drawingData);
          if (!parsedDrawing) {
            res.status(400).json({ error: 'Invalid drawingData data URL' });
            return;
          }
          await upsertCardDrawing(existing.id, parsedDrawing.buffer, parsedDrawing.mime);
        }
      }
    }

    if (req.file) {
      const storage = await getStorageForUser(req.auth!.userId);
      if (storage.mode === 'google') {
        const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
        if (!user?.googleRefreshToken) {
          res.status(400).json({ error: 'Connect Google Drive first' });
          return;
        }
      }
      const fileMeta = await storage.storeFile(req.auth!.userId, req.file, {
        title: (data.title as string) || existing.title,
      });
      if (existing.file?.driveFileId && existing.source === 'uploaded') {
        await googleStorage.deleteRemoteFile?.(req.auth!.userId, existing.file.driveFileId);
      }
      await prisma.cardFile.upsert({
        where: { cardId: existing.id },
        create: {
          cardId: existing.id,
          mimeType: fileMeta.mimeType,
          filename: fileMeta.filename,
          data: fileMeta.data ?? null,
          driveFileId: fileMeta.driveFileId ?? null,
          thumbnailLink: fileMeta.thumbnailLink ?? null,
          thumbnailData: fileMeta.thumbnailData ?? null,
          thumbnailMime: fileMeta.thumbnailMime ?? null,
          size: toDbFileSize(fileMeta.size),
        },
        update: {
          mimeType: fileMeta.mimeType,
          filename: fileMeta.filename,
          data: fileMeta.data ?? null,
          driveFileId: fileMeta.driveFileId ?? null,
          thumbnailLink: fileMeta.thumbnailLink ?? null,
          thumbnailData: fileMeta.thumbnailData ?? null,
          thumbnailMime: fileMeta.thumbnailMime ?? null,
          size: toDbFileSize(fileMeta.size),
        },
      });

      // Multipart fields (multer) — dimensions often arrive with the file upload
      if (body.width) data.width = Number(body.width);
      if (body.height) data.height = Number(body.height);
      if (body.aspectRatio) data.aspectRatio = Number(body.aspectRatio);
      if (body.title) data.title = body.title;
    }

    const card = await prisma.card.update({
      where: { id: existing.id },
      data,
      include: { file: true },
    });

    res.json({ card: serializeCard(card) });
  } catch (err) {
    console.error('Update card error', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Update failed' });
  }
});

cardsRouter.delete('/:id', async (req: AuthRequest, res) => {
  const existing = await prisma.card.findFirst({
    where: { id: req.params.id, profileId: req.auth!.profileId },
    include: { file: true },
  });
  if (!existing) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  // Only delete Drive blobs that Cobea uploaded — never originals imported by sync.
  if (existing.file?.driveFileId && existing.source === 'uploaded') {
    await googleStorage.deleteRemoteFile?.(req.auth!.userId, existing.file.driveFileId);
  }

  await prisma.card.delete({ where: { id: existing.id } });
  res.json({ ok: true });
});

cardsRouter.post('/batch/move', async (req: AuthRequest, res) => {
  const schema = z.object({
    cardIds: z.array(z.string()).min(1),
    folderId: z.string().nullable(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { cardIds, folderId } = parsed.data;
  if (folderId) {
    const folder = await prisma.folder.findFirst({
      where: { id: folderId, profileId: req.auth!.profileId },
    });
    if (!folder) {
      res.status(400).json({ error: 'Invalid folder' });
      return;
    }
  }
  await prisma.card.updateMany({
    where: { id: { in: cardIds }, profileId: req.auth!.profileId },
    data: { folderId },
  });
  res.json({ ok: true });
});

/** Binary drawing upload — avoids huge JSON data-URLs */
cardsRouter.put('/:id/drawing', upload.single('drawing'), async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.card.findFirst({
      where: { id: req.params.id, profileId: req.auth!.profileId },
    });
    if (!existing) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    if (!req.file?.buffer?.length) {
      res.status(400).json({ error: 'drawing file required' });
      return;
    }
    const mime = req.file.mimetype?.startsWith('image/')
      ? req.file.mimetype
      : 'image/png';
    await upsertCardDrawing(existing.id, req.file.buffer, mime);
    // bump updatedAt so clients can cache-bust the drawing URL
    const card = await prisma.card.update({
      where: { id: existing.id },
      data: { updatedAt: new Date() },
      include: { file: true },
    });
    res.json({ card: serializeCard(card) });
  } catch (err) {
    console.error('Put drawing error', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Upload failed' });
  }
});

cardsRouter.delete('/:id/drawing', async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.card.findFirst({
      where: { id: req.params.id, profileId: req.auth!.profileId },
      include: { file: true },
    });
    if (!existing) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    if (existing.file) {
      await prisma.cardFile.update({
        where: { id: existing.file.id },
        data: { drawingData: null, drawingMimeType: null },
      });
    }
    const card = await prisma.card.update({
      where: { id: existing.id },
      data: { updatedAt: new Date() },
      include: { file: true },
    });
    res.json({ card: serializeCard(card) });
  } catch (err) {
    console.error('Delete drawing error', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Delete failed' });
  }
});

async function serveCardMedia(
  req: AuthRequest,
  res: import('express').Response,
  kind: 'file' | 'thumb' | 'drawing'
) {
  const card = await prisma.card.findFirst({
    where: { id: req.params.id, profileId: req.auth!.profileId },
    include: { file: true },
  });
  if (!card?.file) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  if (kind === 'drawing') {
    if (!card.file.drawingData) {
      res.status(404).json({ error: 'No drawing' });
      return;
    }
    res.setHeader('Content-Type', card.file.drawingMimeType || 'image/png');
    res.setHeader('Cache-Control', 'private, no-cache');
    res.send(Buffer.from(card.file.drawingData));
    return;
  }

  if (kind === 'thumb') {
    if (card.file.thumbnailData) {
      res.setHeader('Content-Type', card.file.thumbnailMime || 'image/jpeg');
      res.setHeader('Cache-Control', 'private, max-age=3600');
      res.send(Buffer.from(card.file.thumbnailData));
      return;
    }
    // Lazy: fetch Drive thumbnailLink, cache, serve
    if (card.file.thumbnailLink && card.file.driveFileId) {
      try {
        const refreshed = await refreshDriveThumbnail(
          req.auth!.userId,
          req.auth!.profileId,
          card.id
        );
        if (refreshed.file?.thumbnailData) {
          res.setHeader('Content-Type', refreshed.file.thumbnailMime || 'image/jpeg');
          res.setHeader('Cache-Control', 'private, max-age=3600');
          res.send(Buffer.from(refreshed.file.thumbnailData));
          return;
        }
      } catch (err) {
        console.warn('Lazy thumb refresh failed', err);
      }
    }
    // Fallback: serve full local data as thumb (standard mode) — still 0 Drive calls
    if (card.file.data) {
      res.setHeader('Content-Type', card.file.mimeType);
      res.setHeader('Cache-Control', 'private, max-age=86400');
      res.send(Buffer.from(card.file.data));
      return;
    }
    res.status(404).json({ error: 'No thumbnail' });
    return;
  }

  // kind === 'file'
  // Drive-only cards: never stream the remote blob through Cobea (can be multi-GB).
  if (!card.file.data && card.file.driveFileId) {
    const driveUrl = `https://drive.google.com/file/d/${card.file.driveFileId}/view`;
    res.status(409).json({
      error: 'Le fichier reste sur Google Drive',
      driveUrl,
    });
    return;
  }

  const result = await resolveFileBuffer(req.auth!.userId, {
    data: card.file.data,
    driveFileId: card.file.driveFileId,
    mimeType: card.file.mimeType,
  });
  if (!result) {
    res.status(404).json({ error: 'File not available' });
    return;
  }

  let filename = card.file.filename || card.title || 'download';
  if (result.filenameExt) {
    const base = filename.replace(/\.[^.]+$/, '');
    filename = `${base}.${result.filenameExt}`;
  }
  const safeName = filename.replace(/["\r\n]/g, '_');

  res.setHeader('Content-Type', result.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.send(result.buffer);
}

cardsRouter.get('/:id/file', (req, res) => serveCardMedia(req as AuthRequest, res, 'file'));
cardsRouter.get('/:id/thumb', (req, res) => serveCardMedia(req as AuthRequest, res, 'thumb'));
cardsRouter.get('/:id/drawing', (req, res) => serveCardMedia(req as AuthRequest, res, 'drawing'));

/** Re-fetch expired Drive thumbnailLink (=s1200) and cache bytes */
cardsRouter.post('/:id/thumbnail/refresh', async (req: AuthRequest, res) => {
  try {
    const card = await refreshDriveThumbnail(
      req.auth!.userId,
      req.auth!.profileId,
      req.params.id
    );
    res.json({ card: serializeCard(card) });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    console.error('Thumbnail refresh error', err);
    res.status(status).json({
      error: err instanceof Error ? err.message : 'Refresh failed',
    });
  }
});
