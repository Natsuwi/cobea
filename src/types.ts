export type ItemKind = string;

export type ItemSource =
  | 'default'
  | 'uploaded'
  | 'url'
  | 'note'
  | 'drive'
  | 'mymind';

export interface Folder {
  id: string;
  name: string;
  /** Lucide icon id from folderIcons */
  icon: string;
  createdAt: number;
}

/** Position of a referenced card inside a moodboard (percent of canvas 0–100) */
export interface MoodboardPlacement {
  itemId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  zIndex?: number;
}

export interface ImageItem {
  id: string;
  url: string;
  title: string;
  aspectRatio?: number; // width / height
  tags?: string[];
  dominantColor?: string;
  createdAt: number;
  /** Last modification time (ms) — gallery sorts by this desc */
  updatedAt?: number;
  /** True while the file is still uploading (local preview may be a blob: URL) */
  uploadPending?: boolean;
  isFavorite?: boolean;
  width?: number;
  height?: number;
  source?: ItemSource;
  /** Defaults to 'image' for legacy items */
  kind?: ItemKind;
  /** Markdown body when kind === 'note' */
  markdown?: string;
  /** Plain-text supplementary notes (note items) */
  additionalNotes?: string;
  /** Parent folder id, if any */
  folderId?: string | null;
  /** PNG data URL — visible only in detail view */
  drawingData?: string;
  /** Card layouts when kind === 'moodboard' */
  moodboardPlacements?: MoodboardPlacement[];
  /** MIME type when a file is attached */
  mimeType?: string;
  /** Original filename */
  filename?: string;
  hasFile?: boolean;
  /** True when file bytes are in Postgres (not Drive-only) */
  hasLocalFile?: boolean;
  driveFileId?: string;
  /** Google Drive viewer URL for Drive-backed cards */
  driveUrl?: string;
  /** Drive CDN thumbnail URL (may expire — refresh via API on error) */
  thumbnailLink?: string;
}

export type ThemeMode = 'light' | 'dark';

export type FilterCategory = 'all' | 'favorites' | string;

export interface UserProfile {
  id: string;
  name: string;
  avatarUrl: string;
  theme?: ThemeMode;
}

export function isNoteItem(item: ImageItem): boolean {
  return item.kind?.toLowerCase() === 'note';
}

export function isImageItem(item: ImageItem): boolean {
  const kind = item.kind?.toLowerCase();
  return kind !== 'note' && kind !== 'moodboard';
}

export function isMoodboardItem(item: ImageItem): boolean {
  return item.kind?.toLowerCase() === 'moodboard';
}
