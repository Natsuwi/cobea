import React from 'react';
import { CobeaLogoMark } from './CobeaBrand';

/** Soft loading placeholder for card thumbnails — muted pulsing logo. */
export const CardThumbPlaceholder: React.FC<{
  aspectRatio?: number;
  className?: string;
  /** Smaller mark for compact tiles (dock / moodboard stack) */
  size?: 'sm' | 'md';
}> = ({ aspectRatio = 1.2, className = '', size = 'md' }) => (
  <div
    className={`relative w-full flex items-center justify-center bg-zinc-200/50 dark:bg-zinc-800/50 ${className}`}
    style={{ aspectRatio: String(aspectRatio) }}
    aria-hidden
  >
    <CobeaLogoMark
      className={`${size === 'sm' ? 'w-7 h-7' : 'w-10 h-10'} text-zinc-400/45 dark:text-zinc-500/40 animate-pulse`}
      title=""
    />
  </div>
);
