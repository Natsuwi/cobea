import { google, drive_v3 } from 'googleapis';
import { Readable } from 'node:stream';
import type { Express } from 'express';
import { ItemSource } from '@prisma/client';
import { env } from '../lib/env.js';
import { prisma } from '../lib/prisma.js';
import { recordDriveCall, type DriveCallKind } from '../lib/driveQuota.js';
import { toDbFileSize } from '../lib/fileSize.js';
import type { StorageAdapter, StoredFileMeta } from './types.js';

const DRIVE_FIELDS =
  'id,name,mimeType,thumbnailLink,size,modifiedTime,imageMediaMetadata,shortcutDetails';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const IMAGE_MIME_PREFIX = 'image/';

/** Google Workspace files must be exported (alt=media fails). */
const GOOGLE_EXPORT_MAP: Record<string, { mime: string; ext: string }> = {
  'application/vnd.google-apps.document': {
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ext: 'docx',
  },
  'application/vnd.google-apps.spreadsheet': {
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ext: 'xlsx',
  },
  'application/vnd.google-apps.presentation': {
    mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ext: 'pptx',
  },
  'application/vnd.google-apps.drawing': {
    mime: 'image/png',
    ext: 'png',
  },
};

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

  return instrumentDrive(google.drive({ version: 'v3', auth: client }));
}

function instrumentDrive(drive: drive_v3.Drive): drive_v3.Drive {
  const files = drive.files;

  const wrap = <T extends (...args: never[]) => unknown>(
    fn: T,
    kind: DriveCallKind
  ): T =>
    (async (...args: Parameters<T>) => {
      recordDriveCall(kind);
      return fn(...args);
    }) as T;

  const origGet = files.get.bind(files);
  files.get = ((params?: drive_v3.Params$Resource$Files$Get, options?: unknown) => {
    const alt = params?.alt;
    const kind: DriveCallKind = alt === 'media' ? 'download' : 'read';
    recordDriveCall(kind);
    return origGet(params as drive_v3.Params$Resource$Files$Get, options as never);
  }) as typeof files.get;

  files.list = wrap(files.list.bind(files), 'list');
  files.create = wrap(files.create.bind(files), 'edit');
  files.delete = wrap(files.delete.bind(files), 'edit');
  files.update = wrap(files.update.bind(files), 'edit');
  files.export = wrap(files.export.bind(files), 'download');

  return drive;
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

/** All non-folder files directly in a Drive folder. */
async function listSyncableFilesInFolder(
  drive: drive_v3.Drive,
  folderId: string
): Promise<drive_v3.Schema$File[]> {
  const q = [
    `'${escapeDriveQueryValue(folderId)}' in parents`,
    `mimeType != '${FOLDER_MIME}'`,
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

/** Immediate child folders of a Drive folder. */
async function listChildFolders(
  drive: drive_v3.Drive,
  folderId: string
): Promise<{ id: string; name: string }[]> {
  const q = [
    `'${escapeDriveQueryValue(folderId)}' in parents`,
    `mimeType = '${FOLDER_MIME}'`,
    'trashed = false',
  ].join(' and ');

  const folders: { id: string; name: string }[] = [];
  let pageToken: string | undefined;
  do {
    const res = await drive.files.list({
      q,
      fields: 'nextPageToken, files(id, name)',
      pageSize: 100,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    for (const f of res.data.files ?? []) {
      if (f.id && f.name) folders.push({ id: f.id, name: f.name });
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  return folders;
}

type SyncFileHit = {
  file: drive_v3.Schema$File;
  /** Folder names from the selected sync root down to the file's parent folder */
  pathTags: string[];
};

function normalizePathTags(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of names) {
    const tag = raw.trim();
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out;
}

/**
 * All files under a folder, including nested subfolders (BFS).
 * Each hit includes path folder names for tagging.
 */
async function listSyncableFilesRecursive(
  drive: drive_v3.Drive,
  rootFolderId: string,
  rootFolderName: string
): Promise<SyncFileHit[]> {
  const out: SyncFileHit[] = [];
  const seenFiles = new Set<string>();
  const seenFolders = new Set<string>();
  const queue: { id: string; path: string[] }[] = [
    { id: rootFolderId, path: normalizePathTags([rootFolderName]) },
  ];

  while (queue.length > 0) {
    const { id: folderId, path } = queue.shift()!;
    if (seenFolders.has(folderId)) continue;
    seenFolders.add(folderId);

    const files = await listSyncableFilesInFolder(drive, folderId);
    for (const f of files) {
      if (!f.id || seenFiles.has(f.id)) continue;
      seenFiles.add(f.id);
      out.push({ file: f, pathTags: path });
    }

    const children = await listChildFolders(drive, folderId);
    for (const child of children) {
      if (seenFolders.has(child.id)) continue;
      queue.push({
        id: child.id,
        path: normalizePathTags([...path, child.name]),
      });
    }
  }

  return out;
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
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const id = (item as { id?: unknown }).id;
      const name = (item as { name?: unknown }).name;
      if (typeof id !== 'string' || !id) return null;
      return {
        id,
        name: typeof name === 'string' && name ? name : 'Dossier',
      };
    })
    .filter((x): x is DriveFolderRef => Boolean(x));
}

export type DriveSyncProgress = {
  phase: 'listing' | 'importing' | 'done';
  percent: number;
  message: string;
  current?: number;
  total?: number;
  imported?: number;
  scanned?: number;
  skipped?: number;
  folderCount?: number;
};

export type DriveSyncResult = {
  imported: number;
  scanned: number;
  skipped: number;
  folderCount: number;
  cancelled?: boolean;
};

/**
 * Import files from sync folders into the gallery (images + documents).
 * Concurrent syncs for the same user are coalesced (avoids duplicate cards).
 */
const syncInFlight = new Map<string, Promise<DriveSyncResult>>();
const syncAbortControllers = new Map<string, AbortController>();

export function cancelSyncDriveFoldersForUser(userId: string, profileId: string): boolean {
  const key = `${userId}:${profileId}`;
  const ac = syncAbortControllers.get(key);
  if (!ac) return false;
  ac.abort();
  return true;
}

export function syncDriveFoldersForUser(
  userId: string,
  profileId: string,
  opts?: {
    onProgress?: (p: DriveSyncProgress) => void;
    signal?: AbortSignal;
  }
): Promise<DriveSyncResult> {
  const key = `${userId}:${profileId}`;
  const pending = syncInFlight.get(key);
  // Streaming callers need live progress — wait for any in-flight sync, then run with progress
  if (pending && !opts?.onProgress) return pending;

  const start = async () => {
    if (pending) await pending.catch(() => undefined);
    return runSyncDriveFoldersForUser(userId, profileId, opts?.onProgress, opts?.signal);
  };

  const run = start().finally(() => {
    if (syncInFlight.get(key) === run) syncInFlight.delete(key);
  });
  syncInFlight.set(key, run);
  return run;
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw Object.assign(new Error('Sync cancelled'), { status: 499, cancelled: true });
  }
}

async function runSyncDriveFoldersForUser(
  userId: string,
  profileId: string,
  onProgress?: (p: DriveSyncProgress) => void,
  externalSignal?: AbortSignal
): Promise<DriveSyncResult> {
  const key = `${userId}:${profileId}`;
  const ac = new AbortController();
  syncAbortControllers.set(key, ac);

  if (externalSignal) {
    if (externalSignal.aborted) ac.abort();
    else {
      externalSignal.addEventListener('abort', () => ac.abort(), { once: true });
    }
  }

  const signal = ac.signal;
  const report = (p: DriveSyncProgress) => {
    try {
      onProgress?.(p);
    } catch {
      /* ignore listener errors */
    }
  };

  let imported = 0;
  let scanned = 0;
  let skipped = 0;
  let folderCount = 0;

  const finish = async (
    partial: DriveSyncResult,
    message: string
  ): Promise<DriveSyncResult> => {
    await prisma.user.update({
      where: { id: userId },
      data: { googleLastSyncAt: new Date() },
    });
    report({
      phase: 'done',
      percent: partial.cancelled ? Math.min(99, Math.max(5, partial.scanned > 0 ? 40 : 10)) : 100,
      message,
      imported: partial.imported,
      scanned: partial.scanned,
      skipped: partial.skipped,
      folderCount: partial.folderCount,
    });
    return partial;
  };

  try {
    throwIfAborted(signal);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.googleRefreshToken) {
      throw Object.assign(new Error('Google Drive not connected'), { status: 400 });
    }

    const syncFolders = parseSyncFolders(user.googleSyncFolders);
    folderCount = syncFolders.length;
    if (syncFolders.length === 0) {
      return finish(
        { imported: 0, scanned: 0, skipped: 0, folderCount: 0 },
        'Aucun dossier à synchroniser'
      );
    }

    const drive = await getAuthedDrive(userId);

    const existing = await prisma.cardFile.findMany({
      where: {
        driveFileId: { not: null },
        card: { profileId },
      },
      select: { driveFileId: true },
    });
    const known = new Set(existing.map((e) => e.driveFileId!).filter(Boolean));

    const allHits: SyncFileHit[] = [];
    for (let fi = 0; fi < syncFolders.length; fi++) {
      throwIfAborted(signal);
      const folder = syncFolders[fi]!;
      report({
        phase: 'listing',
        percent: Math.round(((fi + 0.5) / syncFolders.length) * 35),
        message: `Scan de « ${folder.name} »…`,
        current: fi + 1,
        total: syncFolders.length,
      });
      const hits = await listSyncableFilesRecursive(drive, folder.id, folder.name);
      throwIfAborted(signal);
      allHits.push(...hits);
      report({
        phase: 'listing',
        percent: Math.round(((fi + 1) / syncFolders.length) * 35),
        message: `« ${folder.name} » : ${hits.length} fichier${hits.length !== 1 ? 's' : ''}`,
        current: fi + 1,
        total: syncFolders.length,
      });
    }

    const total = allHits.length;
    if (total === 0) {
      return finish(
        { imported: 0, scanned: 0, skipped: 0, folderCount: syncFolders.length },
        'Aucun fichier trouvé'
      );
    }

    for (let i = 0; i < allHits.length; i++) {
      throwIfAborted(signal);
      const { file: f, pathTags } = allHits[i]!;
      if (!f.id) continue;

      // Shortcuts: link the real target so we don't import the same doc twice
      let driveFileId = f.id;
      let mime = f.mimeType || 'application/octet-stream';
      let name = f.name || 'Sans titre';
      let thumbnailLink = f.thumbnailLink ?? null;
      let size = toDbFileSize(f.size);
      let modifiedTime = f.modifiedTime ? new Date(f.modifiedTime) : null;
      let width = f.imageMediaMetadata?.width ?? undefined;
      let height = f.imageMediaMetadata?.height ?? undefined;

      if (mime === 'application/vnd.google-apps.shortcut') {
        const targetId = f.shortcutDetails?.targetId;
        const targetMime = f.shortcutDetails?.targetMimeType;
        if (!targetId) continue;
        driveFileId = targetId;
        if (targetMime) mime = targetMime;
      }

      scanned += 1;
      const percent = 35 + Math.round((scanned / total) * 65);
      report({
        phase: 'importing',
        percent,
        message: name,
        current: scanned,
        total,
        imported,
        scanned,
        skipped,
      });

      if (known.has(driveFileId)) {
        const existingCard = await prisma.card.findFirst({
          where: { profileId, file: { driveFileId } },
          select: { id: true },
        });
        if (existingCard) {
          await prisma.card.update({
            where: { id: existingCard.id },
            data: { tags: pathTags },
          });
        }
        skipped += 1;
        continue;
      }

      // Re-check DB (another sync may have inserted between list and create)
      const already = await prisma.cardFile.findFirst({
        where: { driveFileId, card: { profileId } },
        select: { id: true, cardId: true },
      });
      if (already) {
        known.add(driveFileId);
        await prisma.card.update({
          where: { id: already.cardId },
          data: { tags: pathTags },
        });
        skipped += 1;
        continue;
      }

      const isImage = mime.startsWith(IMAGE_MIME_PREFIX);
      const aspectRatio =
        width && height && height > 0 ? width / height : isImage ? undefined : 0.85;

      let thumbnailData: Buffer | undefined;
      let thumbnailMime: string | undefined;
      // Only cache Google's small preview thumb for images — never the full Drive file
      if (isImage && thumbnailLink) {
        const cached = await cacheThumbnailFromLink(thumbnailLink, user.googleAccessToken);
        thumbnailData = cached.data;
        thumbnailMime = cached.mime;
      }

      try {
        await prisma.card.create({
          data: {
            profileId,
            kind: 'image',
            title: name,
            url: '',
            tags: pathTags,
            source: ItemSource.drive,
            width: isImage ? width ?? null : null,
            height: isImage ? height ?? null : null,
            aspectRatio: aspectRatio ?? null,
            file: {
              create: {
                mimeType: mime,
                filename: name,
                data: null,
                driveFileId,
                thumbnailLink,
                thumbnailData: thumbnailData ?? null,
                thumbnailMime: thumbnailMime ?? null,
                size,
                driveModifiedAt: modifiedTime,
              },
            },
          },
        });
        known.add(driveFileId);
        imported += 1;
      } catch (err) {
        // Unique / race: treat as already imported
        const again = await prisma.cardFile.findFirst({
          where: { driveFileId, card: { profileId } },
          select: { id: true, cardId: true },
        });
        if (again) {
          known.add(driveFileId);
          await prisma.card.update({
            where: { id: again.cardId },
            data: { tags: pathTags },
          });
          skipped += 1;
          continue;
        }
        throw err;
      }
    }

    return finish(
      {
        imported,
        scanned,
        skipped,
        folderCount: syncFolders.length,
      },
      imported > 0
        ? `Terminé — ${imported} importé${imported > 1 ? 's' : ''}`
        : 'Terminé — rien de nouveau'
    );
  } catch (err) {
    if ((err as { cancelled?: boolean }).cancelled || signal.aborted) {
      return finish(
        {
          imported,
          scanned,
          skipped,
          folderCount,
          cancelled: true,
        },
        imported > 0
          ? `Sync interrompue — ${imported} importé${imported > 1 ? 's' : ''}`
          : 'Sync interrompue'
      );
    }
    throw err;
  } finally {
    if (syncAbortControllers.get(key) === ac) {
      syncAbortControllers.delete(key);
    }
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
      size: toDbFileSize(f.size ?? file.size) ?? BigInt(file.size),
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
    const exportSpec = GOOGLE_EXPORT_MAP[meta.mimeType];

    if (exportSpec) {
      const res = await drive.files.export(
        { fileId: meta.driveFileId, mimeType: exportSpec.mime },
        { responseType: 'arraybuffer' }
      );
      return {
        buffer: Buffer.from(res.data as ArrayBuffer),
        mimeType: exportSpec.mime,
        filenameExt: exportSpec.ext,
      };
    }

    if (meta.mimeType.startsWith('application/vnd.google-apps.')) {
      return null;
    }

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
