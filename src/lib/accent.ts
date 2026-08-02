export type AccentId = 'violet' | 'amber';

export type AccentOption = {
  id: AccentId;
  label: string;
  /** Hex without # */
  hex: string;
};

export const ACCENT_KEY = 'zen_gallery_accent_v1';

export const ACCENT_OPTIONS: AccentOption[] = [
  { id: 'violet', label: 'Violet', hex: '970BF5' },
  { id: 'amber', label: 'Ambre', hex: 'F59E0B' },
];

export const DEFAULT_ACCENT: AccentId = 'violet';

export function parseAccentId(value: string | null | undefined): AccentId {
  if (value === 'amber' || value === 'violet') return value;
  return DEFAULT_ACCENT;
}

export function applyAccentToDocument(accent: AccentId) {
  document.documentElement.dataset.accent = accent;
}

/** Current accent as #rrggbb (from CSS vars / preference). */
export function getAccentHex(): string {
  if (typeof document === 'undefined') {
    return `#${ACCENT_OPTIONS.find((o) => o.id === DEFAULT_ACCENT)!.hex}`;
  }
  const fromCss = getComputedStyle(document.documentElement)
    .getPropertyValue('--accent')
    .trim();
  if (fromCss.startsWith('#') && fromCss.length >= 4) {
    return fromCss.length === 4
      ? `#${fromCss[1]}${fromCss[1]}${fromCss[2]}${fromCss[2]}${fromCss[3]}${fromCss[3]}`
      : fromCss.slice(0, 7);
  }
  const id = parseAccentId(document.documentElement.dataset.accent);
  const opt = ACCENT_OPTIONS.find((o) => o.id === id);
  return `#${opt?.hex ?? ACCENT_OPTIONS[0].hex}`;
}
