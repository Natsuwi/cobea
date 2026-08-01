import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { signToken } from '../lib/jwt.js';
import { serializeProfile } from '../lib/serialize.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { env } from '../lib/env.js';
import {
  exchangeGoogleCode,
  getGoogleAuthUrl,
  saveGoogleTokens,
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
    googleConnected: Boolean(user.googleRefreshToken),
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
    googleConnected: Boolean(user.googleRefreshToken),
    storageMode: env.STORAGE_MODE,
  });
});

authRouter.post('/logout', requireAuth, (_req, res) => {
  // JWT is client-side; logout is a no-op server-side (client drops token)
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

authRouter.get('/google', requireAuth, (req: AuthRequest, res) => {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    res.status(503).json({ error: 'Google OAuth not configured' });
    return;
  }
  const state = Buffer.from(
    JSON.stringify({ userId: req.auth!.userId, profileId: req.auth!.profileId })
  ).toString('base64url');
  res.json({ url: getGoogleAuthUrl(state) });
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
    const tokens = await exchangeGoogleCode(code);
    if (!tokens.refresh_token && !tokens.access_token) {
      res.redirect(`${front}/?google=error`);
      return;
    }
    await saveGoogleTokens(state.userId, tokens);
    res.redirect(`${front}/?google=connected`);
  } catch (err) {
    console.error('Google OAuth callback error', err);
    res.redirect(`${front}/?google=error`);
  }
});

authRouter.delete('/google', requireAuth, async (req: AuthRequest, res) => {
  await prisma.user.update({
    where: { id: req.auth!.userId },
    data: {
      googleRefreshToken: null,
      googleAccessToken: null,
      googleTokenExpiry: null,
    },
  });
  res.json({ ok: true });
});
