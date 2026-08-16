import type { Folder, ImageItem, ThemeMode, UserProfile } from '../types';

const TOKEN_KEY = 'cobea_token';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || '';

export type AuthUser = { id: string; email: string };

export type DriveFolderRef = { id: string; name: string };

export type MyMindImportRow = {
  mymindId: string;
  type: string;
  title?: string;
  url?: string;
  content?: string;
  note?: string;
  tags?: string[];
  created?: string;
};

export type StorageState = {
  storageMode: 'standard' | 'google';
  googleConnected: boolean;
  googleConfigured: boolean;
  googleCredentialsSet?: boolean;
  googleUploadFolderId: string | null;
  googleUploadFolderName: string | null;
  googleSyncFolders: DriveFolderRef[];
  googleLastSyncAt: string | null;
};

export type MeResponse = {
  user: AuthUser;
  profile: UserProfile & { theme?: ThemeMode };
  /** True when stored Drive tokens were rejected (invalid_grant) and cleared. */
  googleNeedsReconnect?: boolean;
} & StorageState;

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

/** Append JWT for <img> / canvas loads of protected media */
export function withAccessToken(url: string | undefined | null): string {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  if (!url.includes('/api/cards/')) return url;
  if (/[?&]access_token=/.test(url)) return url;
  const token = getToken();
  if (!token) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}access_token=${encodeURIComponent(token)}`;
}

export function mapCard(raw: ImageItem & { url?: string; drawingData?: string }): ImageItem {
  return {
    ...raw,
    url: withAccessToken(raw.url),
    drawingData: raw.drawingData ? withAccessToken(raw.drawingData) : undefined,
  };
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) throw new Error('Invalid data URL');
  const header = dataUrl.slice(0, comma);
  const base64 = dataUrl.slice(comma + 1);
  const mime = /data:([^;]+)/.exec(header)?.[1] || 'image/png';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

async function request<T>(
  path: string,
  options: RequestInit & { json?: unknown; formData?: FormData } = {}
): Promise<T> {
  const { json, formData, ...fetchInit } = options;
  const headers = new Headers(fetchInit.headers);
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let body = fetchInit.body;
  if (json !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(json);
  }
  if (formData) {
    body = formData;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...fetchInit,
    headers,
    body,
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const data = await res.json();
      message = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
    } catch {
      /* ignore */
    }
    throw new Error(message || `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  config: () =>
    request<{ googleConfigured: boolean; googleRedirectUri: string }>('/api/config'),

  register: (email: string, password: string, name?: string) =>
    request<{
      token: string;
      user: AuthUser;
      profile: UserProfile;
      googleConnected: boolean;
      storageMode: 'standard' | 'google';
      googleConfigured: boolean;
    }>('/api/auth/register', {
      method: 'POST',
      json: { email, password, name },
    }),

  login: (email: string, password: string) =>
    request<{
      token: string;
      user: AuthUser;
      profile: UserProfile;
      googleConnected: boolean;
      storageMode: 'standard' | 'google';
      googleConfigured: boolean;
    }>('/api/auth/login', {
      method: 'POST',
      json: { email, password },
    }),

  me: () => request<MeResponse>('/api/auth/me'),

  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),

  updateProfile: (data: { name?: string; avatarUrl?: string | null; theme?: ThemeMode }) =>
    request<{ profile: UserProfile & { theme?: ThemeMode } }>('/api/auth/profile', {
      method: 'PATCH',
      json: data,
    }),

  updateStorage: (data: {
    storageMode?: 'standard' | 'google';
    googleClientId?: string;
    googleClientSecret?: string;
    googleUploadFolderId?: string | null;
    googleUploadFolderName?: string | null;
    googleSyncFolders?: DriveFolderRef[];
  }) => request<StorageState>('/api/auth/storage', { method: 'PATCH', json: data }),

  googleAuthUrl: () => request<{ url: string }>('/api/auth/google'),

  disconnectGoogle: () => request<{ ok: boolean } & StorageState>('/api/auth/google', { method: 'DELETE' }),

  listDriveFolders: (parentId?: string | null) =>
    request<{
      parentId: string | null;
      parentName: string | null;
      folders: DriveFolderRef[];
      breadcrumbs: DriveFolderRef[];
    }>(
      `/api/auth/google/folders${
        parentId ? `?parentId=${encodeURIComponent(parentId)}` : ''
      }`
    ),

  syncGoogleDrive: () =>
    request<{
      imported: number;
      scanned: number;
      skipped: number;
      folderCount?: number;
      googleLastSyncAt: string | null;
    }>('/api/auth/google/sync', { method: 'POST' }),

  /** Manual sync with live progress (SSE). Pass AbortSignal to interrupt. */
  async syncGoogleDriveWithProgress(
    onProgress: (p: {
      phase: 'listing' | 'importing' | 'done';
      percent: number;
      message: string;
      current?: number;
      total?: number;
      imported?: number;
      scanned?: number;
      skipped?: number;
      folderCount?: number;
    }) => void,
    signal?: AbortSignal
  ): Promise<{
    imported: number;
    scanned: number;
    skipped: number;
    folderCount?: number;
    cancelled?: boolean;
    googleLastSyncAt: string | null;
  }> {
    const token = getToken();
    const headers = new Headers({ Accept: 'text/event-stream' });
    if (token) headers.set('Authorization', `Bearer ${token}`);

    const res = await fetch(`${API_BASE}/api/auth/google/sync?stream=1`, {
      method: 'POST',
      headers,
      signal,
    });
    if (!res.ok || !res.body) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        (err as { error?: string }).error || `Sync failed (${res.status})`
      );
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let result: {
      imported: number;
      scanned: number;
      skipped: number;
      folderCount?: number;
      cancelled?: boolean;
      googleLastSyncAt: string | null;
    } | null = null;
    let streamError: string | null = null;

    const handleBlock = (block: string) => {
      const lines = block.split('\n');
      let event = 'message';
      const dataLines: string[] = [];
      for (const line of lines) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
      }
      if (dataLines.length === 0) return;
      try {
        const data = JSON.parse(dataLines.join('\n')) as Record<string, unknown>;
        if (event === 'progress') {
          onProgress(data as Parameters<typeof onProgress>[0]);
        } else if (event === 'done') {
          result = data as typeof result;
          onProgress({
            phase: 'done',
            percent: 100,
            message: result?.cancelled ? 'Sync interrompue' : 'Terminé',
            imported: result?.imported,
            scanned: result?.scanned,
            skipped: result?.skipped,
            folderCount: result?.folderCount,
          });
        } else if (event === 'error') {
          streamError = String(data.error || 'Sync failed');
        }
      } catch {
        /* ignore parse errors */
      }
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';
        for (const part of parts) {
          if (part.trim()) handleBlock(part);
        }
      }
      if (buffer.trim()) handleBlock(buffer);
    } catch (err) {
      if (signal?.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
        await request<{ ok: boolean; cancelled: boolean }>(
          '/api/auth/google/sync/cancel',
          { method: 'POST' }
        ).catch(() => undefined);
        return {
          imported: 0,
          scanned: 0,
          skipped: 0,
          cancelled: true,
          googleLastSyncAt: null,
        };
      }
      throw err;
    }

    if (streamError) throw new Error(streamError);
    if (!result) {
      if (signal?.aborted) {
        return {
          imported: 0,
          scanned: 0,
          skipped: 0,
          cancelled: true,
          googleLastSyncAt: null,
        };
      }
      throw new Error('Sync interrupted');
    }
    return result;
  },

  cancelGoogleDriveSync: () =>
    request<{ ok: boolean; cancelled: boolean }>('/api/auth/google/sync/cancel', {
      method: 'POST',
    }),

  getDriveUsage: () =>
    request<{
      usage: {
        day: string;
        requests: number;
        units: number;
        dailyLimitUnits: number;
        percentUsed: number;
      };
    }>('/api/auth/google/usage'),

  listFolders: () => request<{ folders: Folder[] }>('/api/folders'),

  createFolder: (name: string, icon: string) =>
    request<{ folder: Folder }>('/api/folders', {
      method: 'POST',
      json: { name, icon },
    }),

  deleteFolder: (id: string) =>
    request<{ ok: boolean }>(`/api/folders/${id}`, { method: 'DELETE' }),

  listCards: () =>
    request<{ cards: ImageItem[] }>('/api/cards').then((r) => ({
      cards: r.cards.map(mapCard),
    })),

  createCard: async (input: {
    title?: string;
    kind?: string;
    tags?: string[];
    folderId?: string | null;
    source?: string;
    markdown?: string;
    additionalNotes?: string;
    url?: string;
    width?: number;
    height?: number;
    aspectRatio?: number;
    moodboardPlacements?: unknown;
    file?: File | Blob;
    fileName?: string;
  }) => {
    const fd = new FormData();
    if (input.title) fd.append('title', input.title);
    if (input.kind) fd.append('kind', input.kind);
    if (input.tags) fd.append('tags', JSON.stringify(input.tags));
    if (input.folderId) fd.append('folderId', input.folderId);
    if (input.source) fd.append('source', input.source);
    if (input.markdown !== undefined) fd.append('markdown', input.markdown);
    if (input.additionalNotes !== undefined) fd.append('additionalNotes', input.additionalNotes);
    if (input.url) fd.append('url', input.url);
    if (input.width) fd.append('width', String(input.width));
    if (input.height) fd.append('height', String(input.height));
    if (input.aspectRatio) fd.append('aspectRatio', String(input.aspectRatio));
    if (input.moodboardPlacements) {
      fd.append('moodboardPlacements', JSON.stringify(input.moodboardPlacements));
    }
    if (input.file) {
      fd.append('file', input.file, input.fileName || 'upload.bin');
    }
    const r = await request<{ card: ImageItem }>('/api/cards', {
      method: 'POST',
      formData: fd,
    });
    return { card: mapCard(r.card) };
  },

  updateCard: async (
    id: string,
    data: Partial<{
      title: string;
      markdown: string;
      additionalNotes: string | null;
      dominantColor: string | null;
      url: string;
      isFavorite: boolean;
      tags: string[];
      folderId: string | null;
      moodboardPlacements: unknown;
      drawingData: string | null;
      width: number;
      height: number;
      aspectRatio: number;
    }>
  ) => {
    // Large canvas PNGs: upload as multipart instead of JSON data-URL
    if (data.drawingData !== undefined && Object.keys(data).length === 1) {
      return api.updateCardDrawing(id, data.drawingData);
    }

    const r = await request<{ card: ImageItem }>(`/api/cards/${id}`, {
      method: 'PATCH',
      json: data,
    });
    return { card: mapCard(r.card) };
  },

  updateCardDrawing: async (id: string, drawingData: string | null) => {
    if (drawingData === null) {
      const r = await request<{ card: ImageItem }>(`/api/cards/${id}/drawing`, {
        method: 'DELETE',
      });
      return { card: mapCard(r.card) };
    }

    if (drawingData.startsWith('data:')) {
      const blob = dataUrlToBlob(drawingData);
      const fd = new FormData();
      fd.append('drawing', blob, 'drawing.png');
      const r = await request<{ card: ImageItem }>(`/api/cards/${id}/drawing`, {
        method: 'PUT',
        formData: fd,
      });
      return { card: mapCard(r.card) };
    }

    // Already a remote URL — nothing to upload
    const r = await request<{ card: ImageItem }>(`/api/cards/${id}`);
    return { card: mapCard(r.card) };
  },

  deleteCard: (id: string) => request<{ ok: boolean }>(`/api/cards/${id}`, { method: 'DELETE' }),

  deleteAllCards: () =>
    request<{ ok: boolean; deleted: number }>('/api/cards/all', { method: 'DELETE' }),

  importMyMindBatch: async (manifest: MyMindImportRow[], files: File[]) => {
    const fd = new FormData();
    fd.append('manifest', JSON.stringify(manifest));
    for (const file of files) {
      fd.append('files', file, file.name);
    }
    const r = await request<{ imported: number; failed: number; cards: ImageItem[] }>(
      '/api/cards/import/mymind',
      { method: 'POST', formData: fd }
    );
    return {
      imported: r.imported,
      failed: r.failed,
      cards: r.cards.map(mapCard),
    };
  },

  refreshCardThumbnail: async (id: string) => {
    const r = await request<{ card: ImageItem }>(`/api/cards/${id}/thumbnail/refresh`, {
      method: 'POST',
    });
    return { card: mapCard(r.card) };
  },

  moveCards: (cardIds: string[], folderId: string | null) =>
    request<{ ok: boolean }>('/api/cards/batch/move', {
      method: 'POST',
      json: { cardIds, folderId },
    }),

  /** Download local bytes, or open Drive for Drive-only cards. */
  async downloadCardFile(
    id: string,
    preferredName?: string,
    opts?: { driveUrl?: string | null }
  ): Promise<void> {
    if (opts?.driveUrl) {
      window.open(opts.driveUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    const token = getToken();
    const headers = new Headers();
    if (token) headers.set('Authorization', `Bearer ${token}`);

    const res = await fetch(`${API_BASE}/api/cards/${id}/file`, { headers });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as {
        error?: string;
        driveUrl?: string;
      };
      if (err.driveUrl) {
        window.open(err.driveUrl, '_blank', 'noopener,noreferrer');
        return;
      }
      throw new Error(err.error || `Download failed (${res.status})`);
    }

    const blob = await res.blob();
    const fromHeader = parseFilenameFromDisposition(res.headers.get('Content-Disposition'));
    const name = fromHeader || preferredName || 'download';

    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objectUrl);
  },
};

function parseFilenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const utf = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf?.[1]) {
    try {
      return decodeURIComponent(utf[1].trim());
    } catch {
      /* ignore */
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain?.[1]?.trim() || null;
}
