import { google, drive_v3 } from 'googleapis';
import { Readable } from 'node:stream';
import type { Express } from 'express';
import { env } from '../lib/env.js';
import { prisma } from '../lib/prisma.js';
import type { StorageAdapter, StoredFileMeta } from './types.js';

const DRIVE_FIELDS = 'id,name,mimeType,thumbnailLink,size,modifiedTime,imageMediaMetadata';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const IMAGE_MIME_PREFIX = 'image/';

export type GoogleCredentialSource = {
  clientId: string;
  clientSecret: string;
};

export type DriveFolderRef = { id: string; name: string };

export type DriveFolderListItem = DriveFolderRef & {
  parentId: string | null;
};

/** Resolve OAuth app credentials: per-user override, else server env. */
export async function resolveGoogleCredentials(
  userId?: string
): Promise<GoogleCredentialSource | null> {
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { googleClientId: true, googleClientSecret: true },
    });
    if (user?.googleClientId && user?.googleClientSecret) {
      return { clientId: user.googleClientId, clientSecret: user.googleClientSecret };
    }
  }
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    return { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET };
  }
  return null;
}

export function isEnvGoogleConfigured() {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

export async function isGoogleConfiguredForUser(userId: string) {
  return Boolean(await resolveGoogleCredentials(userId));
}

function oauthClient(creds: GoogleCredentialSource) {
  return new google.auth.OAuth2(creds.clientId, creds.clientSecret, env.GOOGLE_REDIRECT_URI);
}

export async function getGoogleAuthUrl(userId: string, state: string): Promise<string> {
  const creds = await resolveGoogleCredentials(userId);
  if (!creds) {
    throw Object.assign(new Error('Google OAuth not configured'), { status: 503 });
  }
  const client = oauthClient(creds);
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/drive'],
    state,
  });
}

export async function exchangeGoogleCode(userId: string, code: string) {
  const creds = await resolveGoogleCredentials(userId);
  if (!creds) {
    throw Object.assign(new Error('Google OAuth not configured'), { status: 503 });
  }
  const client = oauthClient(creds);
  const { tokens } = await client.getToken(code);
  return tokens;
}

export async function getAuthedDrive(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.googleRefreshToken) {
    throw Object.assign(new Error('Google Drive not connected'), { status: 400 });
  }

  const creds = await resolveGoogleCredentials(userId);
  if (!creds) {
    throw Object.assign(new Error('Google OAuth not configured'), { status: 503 });
  }

  const client = oauthClient(creds);
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

function escapeDriveQueryValue(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export async function listDriveFolders(
  userId: string,
  parentId?: string | null
): Promise<{
  parentId: string | null;
  parentName: string | null;
  folders: DriveFolderListItem[];
  breadcrumbs: DriveFolderRef[];
}> {
  const drive = await getAuthedDrive(userId);
  const parent = parentId && parentId !== 'root' ? parentId : 'root';

  let parentName: string | null = parent === 'root' ? 'Mon Drive' : null;
  const breadcrumbs: DriveFolderRef[] = [{ id: 'root', name: 'Mon Drive' }];

  if (parent !== 'root') {
    const meta = await drive.files.get({
      fileId: parent,
      fields: 'id,name,parents',
      supportsAllDrives: true,
    });
    parentName = meta.data.name ?? 'Dossier';
    // Build simple breadcrumb: root → current (full chain optional)
    const chain: DriveFolderRef[] = [{ id: meta.data.id!, name: meta.data.name || 'Dossier' }];
    let cursor = meta.data.parents?.[0];
    let guard = 0;
    while (cursor && guard < 8) {
      guard += 1;
      try {
        const p = await drive.files.get({
          fileId: cursor,
          fields: 'id,name,parents',
          supportsAllDrives: true,
        });
        chain.unshift({ id: p.data.id!, name: p.data.name || 'Dossier' });
        cursor = p.data.parents?.[0];
      } catch {
        break;
      }
    }
    breadcrumbs.push(...chain.filter((c) => c.id !== 'root'));
  }

  const q = [
    `'${escapeDriveQueryValue(parent)}' in parents`,
    `mimeType = '${FOLDER_MIME}'`,
    'trashed = false',
  ].join(' and ');

  const folders: DriveFolderListItem[] = [];
  let pageToken: string | undefined;
  do {
    const res = await drive.files.list({
      q,
      fields: 'nextPageToken, files(id, name, parents)',
      orderBy: 'name_natural',
      pageSize: 100,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    for (const f of res.data.files ?? []) {
      if (!f.id || !f.name) continue;
      folders.push({
        id: f.id,
        name: f.name,
        parentId: parent === 'root' ? null : parent,
      });
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return {
    parentId: parent === 'root' ? null : parent,
    parentName,
    folders,
    breadcrumbs,
  };
}

async function listImageFilesInFolder(
  drive: drive_v3.Drive,
  folderId: string
): Promise<drive_v3.Schema$File[]> {
  const q = [
    `'${escapeDriveQueryValue(folderId)}' in parents`,
    `mimeType contains '${IMAGE_MIME_PREFIX}'`,
    'trashed = false',
  ].join(' and ');

  const files: drive_v3.Schema$File[] = [];
  let pageToken: string | undefined;
  do {
    const res = await drive.files.list({
      q,
      fields: `nextPageToken, files(${DRIVE_FIELDS})`,
      pageSize: 100,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    files.push(...(res.data.files ?? []));
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  return files;
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

export function parseSyncFolders(raw: unknown): DriveFolderRef[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const id = (item as { id?: unknown }).id;
      const name = (item as { name?: unknown }).name;
      if (typeof id !== 'string' || typeof name !== 'string') return null;
      return { id, name };
    })
    .filter((x): x is DriveFolderRef => Boolean(x));
}

/**
 * Import new image files from sync folders into the user's gallery.
 * Soft-handles missing Drive files already linked (leave card, clear nothing for v1).
 */
export async function syncDriveFoldersForUser(
  userId: string,
  profileId: string
): Promise<{ imported: number; scanned: number; skipped: number }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.googleRefreshToken) {
    throw Object.assign(new Error('Google Drive not connected'), { status: 400 });
  }

  const syncFolders = parseSyncFolders(user.googleSyncFolders);
  if (syncFolders.length === 0) {
    await prisma.user.update({
      where: { id: userId },
      data: { googleLastSyncAt: new Date() },
    });
    return { imported: 0, scanned: 0, skipped: 0 };
  }

  const drive = await getAuthedDrive(userId);
  let scanned = 0;
  let imported = 0;
  let skipped = 0;

  const existing = await prisma.cardFile.findMany({
    where: {
      driveFileId: { not: null },
      card: { profileId },
    },
    select: { driveFileId: true },
  });
  const known = new Set(existing.map((e) => e.driveFileId!).filter(Boolean));

  for (const folder of syncFolders) {
    const files = await listImageFilesInFolder(drive, folder.id);
    for (const f of files) {
      if (!f.id) continue;
      scanned += 1;
      if (known.has(f.id)) {
        skipped += 1;
        continue;
      }

      const width = f.imageMediaMetadata?.width ?? undefined;
      const height = f.imageMediaMetadata?.height ?? undefined;
      const aspectRatio =
        width && height && height > 0 ? width / height : undefined;

      let thumbnailData: Buffer | undefined;
      let thumbnailMime: string | undefined;
      const cached = await cacheThumbnailFromLink(f.thumbnailLink, user.googleAccessToken);
      thumbnailData = cached.data;
      thumbnailMime = cached.mime;

      await prisma.card.create({
        data: {
          profileId,
          kind: 'image',
          title: f.name || 'Sans titre',
          url: '',
          tags: [],
          source: 'uploaded',
          width: width ?? null,
          height: height ?? null,
          aspectRatio: aspectRatio ?? null,
          file: {
            create: {
              mimeType: f.mimeType || 'image/jpeg',
              filename: f.name || 'image',
              data: null,
              driveFileId: f.id,
              thumbnailLink: f.thumbnailLink ?? null,
              thumbnailData: thumbnailData ?? null,
              thumbnailMime: thumbnailMime ?? null,
              size: f.size ? Number(f.size) : null,
              driveModifiedAt: f.modifiedTime ? new Date(f.modifiedTime) : null,
            },
          },
        },
      });
      known.add(f.id);
      imported += 1;
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: { googleLastSyncAt: new Date() },
  });

  return { imported, scanned, skipped };
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

    const requestBody: drive_v3.Schema$File = {
      name: opts?.title || file.originalname,
    };
    if (user?.googleUploadFolderId) {
      requestBody.parents = [user.googleUploadFolderId];
    }

    const created = await drive.files.create({
      requestBody,
      media: {
        mimeType: file.mimetype,
        body: Readable.from(file.buffer),
      },
      fields: DRIVE_FIELDS,
      supportsAllDrives: true,
    });

    const f = created.data;
    if (!f.id) throw new Error('Drive upload failed: no file id');

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
      { fileId: meta.driveFileId, alt: 'media', supportsAllDrives: true },
      { responseType: 'arraybuffer' }
    );
    const buffer = Buffer.from(res.data as ArrayBuffer);
    return { buffer, mimeType: meta.mimeType };
  },

  async deleteRemoteFile(userId, driveFileId) {
    try {
      const drive = await getAuthedDrive(userId);
      await drive.files.delete({ fileId: driveFileId, supportsAllDrives: true });
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
