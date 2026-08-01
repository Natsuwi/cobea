import type { Folder, ImageItem, ThemeMode, UserProfile } from '../types';

const TOKEN_KEY = 'cobea_token';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || '';

export type AuthUser = { id: string; email: string };
export type MeResponse = {
  user: AuthUser;
  profile: UserProfile & { theme?: ThemeMode };
  googleConnected: boolean;
  storageMode: 'standard' | 'google';
};

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

async function request<T>(
  path: string,
  options: RequestInit & { json?: unknown; formData?: FormData } = {}
): Promise<T> {
  const headers = new Headers(options.headers);
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let body = options.body;
  if (options.json !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(options.json);
  }
  if (options.formData) {
    body = options.formData;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
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
    request<{ storageMode: 'standard' | 'google'; googleConfigured: boolean }>('/api/config'),

  register: (email: string, password: string, name?: string) =>
    request<{ token: string; user: AuthUser; profile: UserProfile }>('/api/auth/register', {
      method: 'POST',
      json: { email, password, name },
    }),

  login: (email: string, password: string) =>
    request<{
      token: string;
      user: AuthUser;
      profile: UserProfile;
      googleConnected: boolean;
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

  googleAuthUrl: () => request<{ url: string }>('/api/auth/google'),

  disconnectGoogle: () => request<{ ok: boolean }>('/api/auth/google', { method: 'DELETE' }),

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
    const r = await request<{ card: ImageItem }>(`/api/cards/${id}`, {
      method: 'PATCH',
      json: data,
    });
    return { card: mapCard(r.card) };
  },

  deleteCard: (id: string) => request<{ ok: boolean }>(`/api/cards/${id}`, { method: 'DELETE' }),

  moveCards: (cardIds: string[], folderId: string | null) =>
    request<{ ok: boolean }>('/api/cards/batch/move', {
      method: 'POST',
      json: { cardIds, folderId },
    }),
};

/** Convert a data URL to a Blob for multipart upload */
export function dataUrlToBlob(dataUrl: string): Blob {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error('Invalid data URL');
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: match[1] });
}
