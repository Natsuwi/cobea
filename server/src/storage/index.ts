import { env } from '../lib/env.js';
import { standardStorage } from './standard.js';
import { googleStorage } from './google.js';
import type { StorageAdapter } from './types.js';

export function getStorage(): StorageAdapter {
  return env.STORAGE_MODE === 'google' ? googleStorage : standardStorage;
}
