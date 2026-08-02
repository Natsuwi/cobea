import type { Express } from 'express';

export type StoredFileMeta = {
  mimeType: string;
  filename: string;
  /** Bytes; may exceed 32-bit — stored as BigInt in DB */
  size: number | bigint;
  driveFileId?: string;
  thumbnailLink?: string;
  thumbnailData?: Buffer;
  thumbnailMime?: string;
  data?: Buffer;
};

export type StorageAdapter = {
  mode: 'standard' | 'google';
  /** Persist binary for a new/updated card. Returns file fields to store in CardFile. */
  storeFile: (
    userId: string,
    file: Express.Multer.File,
    opts?: { title?: string }
  ) => Promise<StoredFileMeta>;
  /** Fetch full file bytes (for download / proxy). Prefer DB/cache over Drive. */
  getFileBuffer: (
    userId: string,
    meta: {
      data: Uint8Array | Buffer | null;
      driveFileId: string | null;
      mimeType: string;
    }
  ) => Promise<{ buffer: Buffer; mimeType: string; filenameExt?: string } | null>;
  deleteRemoteFile?: (userId: string, driveFileId: string) => Promise<void>;
};
