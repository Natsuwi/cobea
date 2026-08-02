import { prisma } from '../lib/prisma.js';
import { standardStorage } from './standard.js';
import { googleStorage } from './google.js';
import type { StorageAdapter } from './types.js';

export async function getUserStorageMode(userId: string): Promise<'standard' | 'google'> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { storageMode: true },
  });
  return user?.storageMode === 'google' ? 'google' : 'standard';
}

/** Adapter for new uploads / deletes based on the user's current preference. */
export async function getStorageForUser(userId: string): Promise<StorageAdapter> {
  const mode = await getUserStorageMode(userId);
  return mode === 'google' ? googleStorage : standardStorage;
}

/**
 * Read bytes for a card file. Prefer local data; if only Drive id exists, use Google
 * even if the user later switched back to standard mode.
 */
export async function resolveFileBuffer(
  userId: string,
  meta: {
    data: Uint8Array | Buffer | null;
    driveFileId: string | null;
    mimeType: string;
  }
) {
  if (meta.data) {
    return standardStorage.getFileBuffer(userId, meta);
  }
  if (meta.driveFileId) {
    return googleStorage.getFileBuffer(userId, meta);
  }
  return null;
}
