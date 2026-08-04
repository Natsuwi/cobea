const LEGACY_COLUMNS_KEY = 'zen_gallery_columns_v1';
export const COLUMNS_DESKTOP_KEY = 'zen_gallery_columns_desktop_v1';
export const COLUMNS_MOBILE_KEY = 'zen_gallery_columns_mobile_v1';

export const DEFAULT_DESKTOP_COLUMNS = 5;
export const DEFAULT_MOBILE_COLUMNS = 2;

/** Tailwind `md` breakpoint — below = mobile prefs */
export const MOBILE_MEDIA_QUERY = '(max-width: 767px)';

export const DESKTOP_COLUMN_OPTIONS = [2, 3, 4, 5, 6] as const;
export const MOBILE_COLUMN_OPTIONS = [1, 2, 3, 4] as const;

export const COLUMN_OPTIONS = {
  desktop: DESKTOP_COLUMN_OPTIONS,
  mobile: MOBILE_COLUMN_OPTIONS,
} as const;

function clampColumns(
  n: number,
  options: readonly number[],
  fallback: number
): number {
  return options.includes(n) ? n : fallback;
}

function readStored(key: string): number | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function loadDesktopColumns(): number {
  const stored = readStored(COLUMNS_DESKTOP_KEY);
  if (stored != null) {
    return clampColumns(stored, DESKTOP_COLUMN_OPTIONS, DEFAULT_DESKTOP_COLUMNS);
  }
  // Migrate former single preference → desktop
  const legacy = readStored(LEGACY_COLUMNS_KEY);
  if (legacy != null) {
    return clampColumns(legacy, DESKTOP_COLUMN_OPTIONS, DEFAULT_DESKTOP_COLUMNS);
  }
  return DEFAULT_DESKTOP_COLUMNS;
}

export function loadMobileColumns(): number {
  const stored = readStored(COLUMNS_MOBILE_KEY);
  if (stored != null) {
    return clampColumns(stored, MOBILE_COLUMN_OPTIONS, DEFAULT_MOBILE_COLUMNS);
  }
  return DEFAULT_MOBILE_COLUMNS;
}

export function persistDesktopColumns(n: number) {
  try {
    localStorage.setItem(COLUMNS_DESKTOP_KEY, String(n));
  } catch {
    /* ignore */
  }
}

export function persistMobileColumns(n: number) {
  try {
    localStorage.setItem(COLUMNS_MOBILE_KEY, String(n));
  } catch {
    /* ignore */
  }
}
