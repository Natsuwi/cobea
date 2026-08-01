import { google } from 'googleapis';
import { Readable } from 'node:stream';
import type { Express } from 'express';
import { env } from '../lib/env.js';
import { prisma } from '../lib/prisma.js';
import type { StorageAdapter, StoredFileMeta } from './types.js';

const DRIVE_FIELDS = 'id,name,mimeType,thumbnailLink,size,modifiedTime';

function oauthClient() {
  return new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI
  );
}

export function getGoogleAuthUrl(state: string): string {
  const client = oauthClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/drive.file'],
    state,
  });
}

export async function exchangeGoogleCode(code: string) {
  const client = oauthClient();
  const { tokens } = await client.getToken(code);
  return tokens;
}

async function getAuthedDrive(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.googleRefreshToken) {
    throw Object.assign(new Error('Google Drive not connected'), { status: 400 });
  }

  const client = oauthClient();
  client.setCredentials({
    refresh_token: user.googleRefreshToken,
    access_token: user.googleAccessToken ?? undefined,
    expiry_date: user.googleTokenExpiry?.getTime(),
  });

  client.on('tokens', async (tokens) => {
    await prisma.user.update({
      where: { id: userId },
      data: {
        googleAccessToken: tokens.access_token ?? undefined,
        googleTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
        ...(tokens.refresh_token ? { googleRefreshToken: tokens.refresh_token } : {}),
      },
    });
  });

  return google.drive({ version: 'v3', auth: client });
}

async function cacheThumbnailFromLink(
  thumbnailLink: string | null | undefined,
  accessToken: string | null | undefined
): Promise<{ data?: Buffer; mime?: string }> {
  if (!thumbnailLink) return {};
  try {
    const res = await fetch(thumbnailLink, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    });
    if (!res.ok) return {};
    const buf = Buffer.from(await res.arrayBuffer());
    const mime = res.headers.get('content-type') ?? 'image/jpeg';
    return { data: buf, mime };
  } catch {
    return {};
  }
}

export const googleStorage: StorageAdapter = {
  mode: 'google',

  async storeFile(
    userId: string,
    file: Express.Multer.File,
    opts?: { title?: string }
  ): Promise<StoredFileMeta> {
    const drive = await getAuthedDrive(userId);
    const user = await prisma.user.findUnique({ where: { id: userId } });

    const created = await drive.files.create({
      requestBody: {
        name: opts?.title || file.originalname,
      },
      media: {
        mimeType: file.mimetype,
        body: Readable.from(file.buffer),
      },
      fields: DRIVE_FIELDS,
    });

    const f = created.data;
    if (!f.id) throw new Error('Drive upload failed: no file id');

    // Prefer local image buffer as thumb for images (0 extra Drive media download).
    // Otherwise fetch thumbnailLink once and cache.
    let thumbnailData: Buffer | undefined;
    let thumbnailMime: string | undefined;

    if (file.mimetype.startsWith('image/')) {
      thumbnailData = file.buffer;
      thumbnailMime = file.mimetype;
    } else {
      const cached = await cacheThumbnailFromLink(
        f.thumbnailLink,
        user?.googleAccessToken
      );
      thumbnailData = cached.data;
      thumbnailMime = cached.mime;
    }

    return {
      mimeType: f.mimeType || file.mimetype,
      filename: f.name || file.originalname,
      size: f.size ? Number(f.size) : file.size,
      driveFileId: f.id,
      thumbnailLink: f.thumbnailLink ?? undefined,
      thumbnailData,
      thumbnailMime,
      // Do NOT store full binary in Postgres in Google mode
      data: undefined,
    };
  },

  async getFileBuffer(userId, meta) {
    if (meta.data) {
      return { buffer: Buffer.from(meta.data), mimeType: meta.mimeType };
    }
    if (!meta.driveFileId) return null;

    const drive = await getAuthedDrive(userId);
    const res = await drive.files.get(
      { fileId: meta.driveFileId, alt: 'media' },
      { responseType: 'arraybuffer' }
    );
    const buffer = Buffer.from(res.data as ArrayBuffer);
    return { buffer, mimeType: meta.mimeType };
  },

  async deleteRemoteFile(userId, driveFileId) {
    try {
      const drive = await getAuthedDrive(userId);
      await drive.files.delete({ fileId: driveFileId });
    } catch {
      // Ignore remote delete failures (file already gone, etc.)
    }
  },
};

export async function saveGoogleTokens(
  userId: string,
  tokens: {
    refresh_token?: string | null;
    access_token?: string | null;
    expiry_date?: number | null;
  }
) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      ...(tokens.refresh_token ? { googleRefreshToken: tokens.refresh_token } : {}),
      googleAccessToken: tokens.access_token ?? undefined,
      googleTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
    },
  });
}
