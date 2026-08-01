import type { Express } from 'express';
import type { StorageAdapter, StoredFileMeta } from './types.js';

export const standardStorage: StorageAdapter = {
  mode: 'standard',

  async storeFile(
    _userId: string,
    file: Express.Multer.File,
    _opts?: { title?: string }
  ): Promise<StoredFileMeta> {
    return {
      mimeType: file.mimetype,
      filename: file.originalname,
      size: file.size,
      data: file.buffer,
      thumbnailData: file.mimetype.startsWith('image/') ? file.buffer : undefined,
      thumbnailMime: file.mimetype.startsWith('image/') ? file.mimetype : undefined,
    };
  },

  async getFileBuffer(_userId, meta) {
    if (!meta.data) return null;
    return { buffer: Buffer.from(meta.data), mimeType: meta.mimeType };
  },
};
