import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { signToken } from '../lib/jwt.js';
import { serializeProfile } from '../lib/serialize.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { env } from '../lib/env.js';
import {
  exchangeGoogleCode,
  getGoogleAuthUrl,
  isEnvGoogleConfigured,
  isGoogleConfiguredForUser,
  listDriveFolders,
  parseSyncFolders,
  saveGoogleTokens,
  syncDriveFoldersForUser,
  type DriveFolderRef,
} from '../storage/google.js';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(80).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const folderRefSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});

export type StoragePayload = {
  storageMode: 'standard' | 'google';
  googleConnected: boolean;
  googleConfigured: boolean;
  googleCredentialsSet: boolean;
  googleUploadFolderId: string | null;
  googleUploadFolderName: string | null;
  googleSyncFolders: DriveFolderRef[];
  googleLastSyncAt: string | null;
};

function storagePayload(user: {
  storageMode: string;
  googleRefreshToken: string | null;
  googleClientId: string | null;
  googleClientSecret: string | null;
  googleUploadFolderId?: string | null;
  googleUploadFolderName?: string | null;
  googleSyncFolders?: unknown;
  googleLastSyncAt?: Date | null;
}): StoragePayload {
  const googleCredentialsSet = Boolean(
    (user.googleClientId && user.googleClientSecret) || isEnvGoogleConfigured()
  );
  return {
    storageMode: (user.storageMode === 'google' ? 'google' : 'standard') as
      | 'standard'
      | 'google',
    googleConnected: Boolean(user.googleRefreshToken),
    googleConfigured: googleCredentialsSet,
    googleCredentialsSet,
    googleUploadFolderId: user.googleUploadFolderId ?? null,
    googleUploadFolderName: user.googleUploadFolderName ?? null,
    googleSyncFolders: parseSyncFolders(user.googleSyncFolders),
    googleLastSyncAt: user.googleLastSyncAt
      ? user.googleLastSyncAt.toISOString()
      : null,
  };
}

export const authRouter = Router();

authRouter.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { email, password, name } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    res.status(409).json({ error: 'Email already registered' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const displayName = name?.trim() || email.split('@')[0];

  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      passwordHash,
      profile: {
        create: {
          name: displayName,
          avatarUrl: null,
        },
      },
    },
    include: { profile: true },
  });

  if (!user.profile) {
    res.status(500).json({ error: 'Profile creation failed' });
    return;
  }

  const token = signToken({ userId: user.id, profileId: user.profile.id });
  res.status(201).json({
    token,
    user: { id: user.id, email: user.email },
    profile: serializeProfile(user.profile),
    ...storagePayload(user),
  });
});

authRouter.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: { profile: true },
  });
  if (!user?.profile) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const token = signToken({ userId: user.id, profileId: user.profile.id });
  res.json({
    token,
    user: { id: user.id, email: user.email },
    profile: serializeProfile(user.profile),
    ...storagePayload(user),
  });
});

authRouter.get('/me', requireAuth, async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.auth!.userId },
    include: { profile: true },
  });
  if (!user?.profile) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json({
    user: { id: user.id, email: user.email },
    profile: serializeProfile(user.profile),
    ...storagePayload(user),
  });
});

authRouter.post('/logout', requireAuth, (_req, res) => {
  res.json({ ok: true });
});

authRouter.patch('/profile', requireAuth, async (req: AuthRequest, res) => {
  const schema = z.object({
    name: z.string().min(1).max(80).optional(),
    avatarUrl: z.string().url().nullable().optional(),
    theme: z.enum(['light', 'dark']).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const profile = await prisma.profile.update({
    where: { id: req.auth!.profileId },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.avatarUrl !== undefined ? { avatarUrl: parsed.data.avatarUrl } : {}),
      ...(parsed.data.theme !== undefined ? { theme: parsed.data.theme } : {}),
    },
  });
  res.json({ profile: serializeProfile(profile) });
});

authRouter.patch('/storage', requireAuth, async (req: AuthRequest, res) => {
  const schema = z.object({
    storageMode: z.enum(['standard', 'google']).optional(),
    googleClientId: z.string().min(1).optional(),
    googleClientSecret: z.string().min(1).optional(),
    googleUploadFolderId: z.string().min(1).nullable().optional(),
    googleUploadFolderName: z.string().min(1).nullable().optional(),
    googleSyncFolders: z.array(folderRefSchema).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const {
    storageMode,
    googleClientId,
    googleClientSecret,
    googleUploadFolderId,
    googleUploadFolderName,
    googleSyncFolders,
  } = parsed.data;

  if (storageMode === 'google') {
    const wouldHaveCreds =
      (googleClientId && googleClientSecret) ||
      (await isGoogleConfiguredForUser(req.auth!.userId));
    if (!wouldHaveCreds) {
      res.status(400).json({
        error:
          'Indique Client ID et Client Secret Google (console Cloud), ou configure-les côté serveur.',
      });
      return;
    }
  }

  const data: Prisma.UserUpdateInput = {
    ...(storageMode !== undefined ? { storageMode } : {}),
    ...(googleClientId !== undefined ? { googleClientId } : {}),
    ...(googleClientSecret !== undefined ? { googleClientSecret } : {}),
  };

  if (googleUploadFolderId !== undefined) {
    data.googleUploadFolderId = googleUploadFolderId;
    if (googleUploadFolderId === null) {
      data.googleUploadFolderName = null;
    } else if (googleUploadFolderName !== undefined) {
      data.googleUploadFolderName = googleUploadFolderName;
    }
  } else if (googleUploadFolderName !== undefined) {
    data.googleUploadFolderName = googleUploadFolderName;
  }

  if (googleSyncFolders !== undefined) {
    data.googleSyncFolders = googleSyncFolders;
  }

  const user = await prisma.user.update({
    where: { id: req.auth!.userId },
    data,
  });

  res.json(storagePayload(user));
});

authRouter.get('/google', requireAuth, async (req: AuthRequest, res) => {
  try {
    const state = Buffer.from(
      JSON.stringify({ userId: req.auth!.userId, profileId: req.auth!.profileId })
    ).toString('base64url');
    const url = await getGoogleAuthUrl(req.auth!.userId, state);
    res.json({ url });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    res.status(status).json({
      error: err instanceof Error ? err.message : 'Google OAuth not configured',
    });
  }
});

authRouter.get('/google/callback', async (req, res) => {
  const code = String(req.query.code || '');
  const stateRaw = String(req.query.state || '');
  const front = env.CORS_ORIGIN.replace(/\/$/, '');

  if (!code || !stateRaw) {
    res.redirect(`${front}/?google=error`);
    return;
  }

  try {
    const state = JSON.parse(Buffer.from(stateRaw, 'base64url').toString('utf8')) as {
      userId: string;
    };
    const tokens = await exchangeGoogleCode(state.userId, code);
    if (!tokens.refresh_token && !tokens.access_token) {
      res.redirect(`${front}/?google=error`);
      return;
    }
    await saveGoogleTokens(state.userId, tokens);
    await prisma.user.update({
      where: { id: state.userId },
      data: { storageMode: 'google' },
    });
    res.redirect(`${front}/?google=connected`);
  } catch (err) {
    console.error('Google OAuth callback error', err);
    res.redirect(`${front}/?google=error`);
  }
});

authRouter.get('/google/folders', requireAuth, async (req: AuthRequest, res) => {
  try {
    const parentId =
      typeof req.query.parentId === 'string' && req.query.parentId.length > 0
        ? req.query.parentId
        : null;
    const result = await listDriveFolders(req.auth!.userId, parentId);
    res.json(result);
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    res.status(status).json({
      error: err instanceof Error ? err.message : 'Failed to list folders',
    });
  }
});

authRouter.post('/google/sync', requireAuth, async (req: AuthRequest, res) => {
  try {
    const result = await syncDriveFoldersForUser(req.auth!.userId, req.auth!.profileId);
    const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
    res.json({
      ...result,
      googleLastSyncAt: user?.googleLastSyncAt?.toISOString() ?? null,
    });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    res.status(status).json({
      error: err instanceof Error ? err.message : 'Sync failed',
    });
  }
});

authRouter.delete('/google', requireAuth, async (req: AuthRequest, res) => {
  const user = await prisma.user.update({
    where: { id: req.auth!.userId },
    data: {
      googleRefreshToken: null,
      googleAccessToken: null,
      googleTokenExpiry: null,
      googleUploadFolderId: null,
      googleUploadFolderName: null,
      googleSyncFolders: Prisma.JsonNull,
      googleLastSyncAt: null,
    },
  });
  res.json({ ok: true, ...storagePayload(user) });
});
