/** Cobea native kinds */
export const COBEA_KINDS = ['image', 'note', 'moodboard'] as const;

/** MyMind export kinds observed in cards.csv */
export const MYMIND_KNOWN_KINDS = [
  'Article',
  'Book',
  'Content',
  'Image',
  'Movie',
  'MusicAlbum',
  'Note',
  'Placeholder',
  'Product',
  'Recipe',
  'RedditPost',
  'Repository',
  'SoftwareApplication',
  'TVSeries',
  'Video',
  'VideoGame',
  'WebPage',
  'YouTubeVideo',
] as const;

export function normalizeKind(kind?: string | null): string {
  return kind?.trim() || 'image';
}

export function kindKey(kind?: string | null): string {
  return normalizeKind(kind).toLowerCase();
}

export function isKnownKind(kind?: string | null): boolean {
  const key = kindKey(kind);
  if ((COBEA_KINDS as readonly string[]).includes(key)) return true;
  return MYMIND_KNOWN_KINDS.some((k) => k.toLowerCase() === key);
}

export function isUnknownKind(kind?: string | null): boolean {
  return !isKnownKind(kind);
}

/** Website / bookmark cards — URL opens the site, not a detail modal. */
export function isWebPageKind(kind?: string | null): boolean {
  const key = kindKey(kind);
  return key === 'webpage' || key === 'website';
}

export function externalUrlForCard(url?: string | null): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  return null;
}

export function hostnameFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
