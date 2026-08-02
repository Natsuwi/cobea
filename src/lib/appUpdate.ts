const DISMISSED_KEY = 'cobea_update_dismissed_build';

export type RemoteVersion = {
  buildId: string;
  builtAt?: string;
};

export function getClientBuildId(): string {
  try {
    if (typeof __APP_BUILD_ID__ === 'string' && __APP_BUILD_ID__) {
      return __APP_BUILD_ID__;
    }
  } catch {
    /* ignore */
  }
  return import.meta.env.VITE_APP_BUILD_ID || 'unknown';
}

export async function fetchRemoteVersion(): Promise<RemoteVersion | null> {
  try {
    const res = await fetch(`/version.json?_=${Date.now()}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as RemoteVersion;
    if (!data?.buildId || typeof data.buildId !== 'string') return null;
    return data;
  } catch {
    return null;
  }
}

export function isUpdateAvailable(remote: RemoteVersion | null): boolean {
  if (!remote?.buildId) return false;
  const local = getClientBuildId();
  if (!local || local === 'unknown') return false;
  return remote.buildId !== local;
}

export function wasDismissedFor(buildId: string): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === buildId;
  } catch {
    return false;
  }
}

export function dismissUpdate(buildId: string) {
  try {
    localStorage.setItem(DISMISSED_KEY, buildId);
  } catch {
    /* ignore */
  }
}

function clearDocumentCookies() {
  const cookies = document.cookie.split(';');
  for (const raw of cookies) {
    const name = raw.split('=')[0]?.trim();
    if (!name) continue;
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`;
  }
}

async function clearCacheStorage() {
  if (!('caches' in window)) return;
  const keys = await caches.keys();
  await Promise.all(keys.map((key) => caches.delete(key)));
}

async function unregisterServiceWorkers() {
  if (!('serviceWorker' in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(regs.map((reg) => reg.unregister()));
}

const PRESERVE_KEYS = [
  'cobea_token',
  'cobea_accounts_v1',
  'zen_gallery_theme_v1',
  'zen_gallery_columns_v1',
  'zen_gallery_accent_v1',
  DISMISSED_KEY,
] as const;

/**
 * Hard refresh: purge Cache API, SW, cookies, sessionStorage,
 * wipe localStorage except auth + theme, then reload bypassing HTTP cache.
 */
export async function forceAppUpdate(): Promise<void> {
  const preserved: Record<string, string> = {};
  for (const key of PRESERVE_KEYS) {
    try {
      const value = localStorage.getItem(key);
      if (value != null) preserved[key] = value;
    } catch {
      /* ignore */
    }
  }

  try {
    await clearCacheStorage();
  } catch {
    /* ignore */
  }
  try {
    await unregisterServiceWorkers();
  } catch {
    /* ignore */
  }
  try {
    clearDocumentCookies();
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.clear();
  } catch {
    /* ignore */
  }
  try {
    localStorage.clear();
    for (const [key, value] of Object.entries(preserved)) {
      localStorage.setItem(key, value);
    }
    localStorage.removeItem(DISMISSED_KEY);
  } catch {
    /* ignore */
  }

  const url = new URL(window.location.href);
  url.searchParams.set('_refresh', String(Date.now()));
  window.location.replace(url.toString());
}
