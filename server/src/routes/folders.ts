import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { serializeFolder } from '../lib/serialize.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

export const foldersRouter = Router();
foldersRouter.use(requireAuth);

foldersRouter.get('/', async (req: AuthRequest, res) => {
  const folders = await prisma.folder.findMany({
    where: { profileId: req.auth!.profileId },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ folders: folders.map(serializeFolder) });
});

foldersRouter.post('/', async (req: AuthRequest, res) => {
  const schema = z.object({
    name: z.string().min(1).max(120),
    icon: z.string().min(1).max(64).default('folder'),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const folder = await prisma.folder.create({
    data: {
      profileId: req.auth!.profileId,
      name: parsed.data.name,
      icon: parsed.data.icon,
    },
  });
  res.status(201).json({ folder: serializeFolder(folder) });
});

foldersRouter.patch('/:id', async (req: AuthRequest, res) => {
  const schema = z.object({
    name: z.string().min(1).max(120).optional(),
    icon: z.string().min(1).max(64).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const existing = await prisma.folder.findFirst({
    where: { id: req.params.id, profileId: req.auth!.profileId },
  });
  if (!existing) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const folder = await prisma.folder.update({
    where: { id: existing.id },
    data: parsed.data,
  });
  res.json({ folder: serializeFolder(folder) });
});

foldersRouter.delete('/:id', async (req: AuthRequest, res) => {
  const existing = await prisma.folder.findFirst({
    where: { id: req.params.id, profileId: req.auth!.profileId },
  });
  if (!existing) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  await prisma.folder.delete({ where: { id: existing.id } });
  res.json({ ok: true });
});
