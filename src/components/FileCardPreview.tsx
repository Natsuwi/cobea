import React from 'react';
import {
  File,
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileType2,
  FileVideo,
  Presentation,
} from 'lucide-react';
import type { ImageItem } from '../types';

/** True when the card should render as a real image (not an icon file tile). */
export function isDisplayableImageItem(item: ImageItem): boolean {
  if (item.kind === 'note' || item.kind === 'moodboard') return false;
  if (!item.url) return false;
  const mime = item.mimeType?.toLowerCase() ?? '';
  if (mime.startsWith('image/')) return true;
  if (mime) return false;
  // Legacy cards without mimeType: treat as image if URL looks usable
  return true;
}

export function getFileExtension(filenameOrTitle?: string | null): string {
  if (!filenameOrTitle) return '';
  const base = filenameOrTitle.split(/[/\\]/).pop() || '';
  const clean = base.split('?')[0];
  const dot = clean.lastIndexOf('.');
  if (dot <= 0 || dot === clean.length - 1) return '';
  return clean.slice(dot + 1).toLowerCase();
}

type IconComp = React.ComponentType<{ className?: string }>;

function iconForExt(ext: string, mime: string): { Icon: IconComp; tint: string } {
  if (mime.startsWith('video/') || ['mp4', 'mov', 'webm', 'mkv', 'avi'].includes(ext)) {
    return { Icon: FileVideo, tint: 'text-violet-500' };
  }
  if (mime.startsWith('audio/') || ['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg'].includes(ext)) {
    return { Icon: FileAudio, tint: 'text-pink-500' };
  }
  if (
    mime.includes('zip') ||
    mime.includes('compressed') ||
    ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)
  ) {
    return { Icon: FileArchive, tint: 'text-amber-600' };
  }
  if (
    mime.includes('sheet') ||
    mime.includes('excel') ||
    ['xls', 'xlsx', 'csv', 'ods'].includes(ext)
  ) {
    return { Icon: FileSpreadsheet, tint: 'text-emerald-600' };
  }
  if (
    mime.includes('presentation') ||
    mime.includes('powerpoint') ||
    ['ppt', 'pptx', 'key'].includes(ext)
  ) {
    return { Icon: Presentation, tint: 'text-orange-500' };
  }
  if (
    mime.includes('pdf') ||
    mime.includes('document') ||
    mime.includes('msword') ||
    mime.includes('text') ||
    ['pdf', 'doc', 'docx', 'txt', 'rtf', 'md', 'pages'].includes(ext)
  ) {
    return { Icon: FileText, tint: 'text-sky-600' };
  }
  if (
    mime.includes('javascript') ||
    mime.includes('json') ||
    mime.includes('xml') ||
    ['js', 'ts', 'tsx', 'jsx', 'json', 'html', 'css', 'py', 'go', 'rs'].includes(ext)
  ) {
    return { Icon: FileCode, tint: 'text-cyan-600' };
  }
  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'heic'].includes(ext)) {
    return { Icon: FileImage, tint: 'text-rose-500' };
  }
  if (ext) {
    return { Icon: FileType2, tint: 'text-zinc-500' };
  }
  return { Icon: File, tint: 'text-zinc-500' };
}

interface FileCardPreviewProps {
  title: string;
  mimeType?: string | null;
  filename?: string | null;
  className?: string;
  /** Larger layout for detail modal */
  size?: 'sm' | 'md' | 'lg';
}

/** Tile: extension icon + file name (for Drive docs / non-image cards). */
export const FileCardPreview: React.FC<FileCardPreviewProps> = ({
  title,
  mimeType,
  filename,
  className = '',
  size = 'md',
}) => {
  const ext = getFileExtension(filename || title);
  const { Icon, tint } = iconForExt(ext, mimeType?.toLowerCase() ?? '');
  const label = title || filename || 'Fichier';

  const pad = size === 'lg' ? 'p-8' : size === 'sm' ? 'p-3' : 'p-5';
  const iconBox =
    size === 'lg' ? 'w-24 h-24' : size === 'sm' ? 'w-12 h-12' : 'w-16 h-16';
  const iconSize = size === 'lg' ? 'w-12 h-12' : size === 'sm' ? 'w-6 h-6' : 'w-8 h-8';
  const titleCls =
    size === 'lg' ? 'text-base mt-5' : size === 'sm' ? 'text-[10px] mt-2' : 'text-xs mt-3';
  const badgeCls = size === 'lg' ? 'text-xs mt-2' : 'text-[10px] mt-1';

  return (
    <div
      className={`w-full h-full min-h-[140px] flex flex-col items-center justify-center ${pad} bg-gradient-to-br from-zinc-100 to-zinc-200/80 dark:from-zinc-800 dark:to-zinc-900 text-center ${className}`}
    >
      <div
        className={`${iconBox} rounded-2xl bg-white dark:bg-zinc-950 shadow-md border border-black/5 dark:border-white/10 flex items-center justify-center ${tint}`}
      >
        <Icon className={iconSize} />
      </div>
      <p
        className={`${titleCls} font-medium text-zinc-800 dark:text-zinc-100 line-clamp-3 max-w-[90%] leading-snug`}
      >
        {label}
      </p>
      {ext ? (
        <span
          className={`${badgeCls} uppercase tracking-wider font-semibold text-zinc-400 dark:text-zinc-500`}
        >
          .{ext}
        </span>
      ) : null}
    </div>
  );
};
