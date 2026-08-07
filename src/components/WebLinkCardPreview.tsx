import React from 'react';
import { ExternalLink, Globe } from 'lucide-react';
import { hostnameFromUrl } from '../lib/cardKinds';

interface WebLinkCardPreviewProps {
  title: string;
  url: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/** Bookmark tile for WebPage / website cards. */
export const WebLinkCardPreview: React.FC<WebLinkCardPreviewProps> = ({
  title,
  url,
  className = '',
  size = 'md',
}) => {
  const host = hostnameFromUrl(url);
  const label = title?.trim() || host || 'Site web';

  const pad = size === 'lg' ? 'p-8' : size === 'sm' ? 'p-3' : 'p-5';
  const iconBox =
    size === 'lg' ? 'w-24 h-24' : size === 'sm' ? 'w-12 h-12' : 'w-16 h-16';
  const iconSize = size === 'lg' ? 'w-12 h-12' : size === 'sm' ? 'w-6 h-6' : 'w-8 h-8';
  const titleCls =
    size === 'lg' ? 'text-base mt-5' : size === 'sm' ? 'text-[10px] mt-2' : 'text-xs mt-3';
  const hostCls = size === 'lg' ? 'text-sm mt-2' : 'text-[10px] mt-1.5';

  return (
    <div
      className={`w-full h-full min-h-[140px] flex flex-col items-center justify-center ${pad} bg-gradient-to-br from-sky-50 to-indigo-100/90 dark:from-sky-950/40 dark:to-indigo-950/50 text-center ${className}`}
    >
      <div
        className={`${iconBox} rounded-2xl bg-white dark:bg-zinc-950 shadow-md border border-sky-200/80 dark:border-sky-500/20 flex items-center justify-center text-sky-600 dark:text-sky-400`}
      >
        <Globe className={iconSize} strokeWidth={1.75} />
      </div>
      <p
        className={`${titleCls} font-medium text-zinc-800 dark:text-zinc-100 line-clamp-3 max-w-[90%] leading-snug`}
      >
        {label}
      </p>
      {host ? (
        <span
          className={`${hostCls} inline-flex items-center gap-1 font-medium text-sky-700/80 dark:text-sky-300/90 truncate max-w-[92%]`}
        >
          <ExternalLink className="w-3 h-3 shrink-0 opacity-70" />
          <span className="truncate">{host}</span>
        </span>
      ) : null}
    </div>
  );
};
