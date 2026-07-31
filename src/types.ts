export type ItemKind = 'image' | 'note' | 'moodboard';

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
  isFavorite?: boolean;
  width?: number;
  height?: number;
  source?: 'default' | 'uploaded' | 'url' | 'note';
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
}

export type ThemeMode = 'light' | 'dark';

export type FilterCategory = 'all' | 'favorites' | string;

export interface UserProfile {
  id: string;
  name: string;
  avatarUrl: string;
}

export function isNoteItem(item: ImageItem): boolean {
  return item.kind === 'note';
}

export function isImageItem(item: ImageItem): boolean {
  return item.kind !== 'note' && item.kind !== 'moodboard';
}

export function isMoodboardItem(item: ImageItem): boolean {
  return item.kind === 'moodboard';
}
