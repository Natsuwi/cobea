import React, { useEffect, useRef, useState } from 'react';
import type { ImageItem } from '../types';
import { api, withAccessToken } from '../lib/api';

type Props = {
  item: ImageItem;
  alt?: string;
  className?: string;
  loading?: 'lazy' | 'eager';
  draggable?: boolean;
  onLoad?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
  /** Called after a successful Drive thumbnail refresh */
  onCardUpdated?: (card: ImageItem) => void;
  /** Fallback when refresh fails or is impossible */
  onFailed?: () => void;
};

/**
 * <img> that refreshes an expired Drive thumbnailLink via the API once on error.
 */
export const RefreshableThumb: React.FC<Props> = ({
  item,
  alt,
  className,
  loading = 'lazy',
  draggable = false,
  onLoad,
  onCardUpdated,
  onFailed,
}) => {
  const [src, setSrc] = useState(item.url);
  const triedRefreshRef = useRef(false);

  useEffect(() => {
    setSrc(item.url);
    triedRefreshRef.current = false;
  }, [item.id, item.url]);

  const handleError = () => {
    if (triedRefreshRef.current || !item.driveFileId) {
      onFailed?.();
      return;
    }
    triedRefreshRef.current = true;
    void (async () => {
      try {
        const { card } = await api.refreshCardThumbnail(item.id);
        onCardUpdated?.(card);
        const next = withAccessToken(card.url);
        const bust = `${next}${next.includes('?') ? '&' : '?'}r=${Date.now()}`;
        setSrc(bust);
      } catch {
        onFailed?.();
      }
    })();
  };

  if (!src) return null;

  return (
    <img
      src={src}
      alt={alt ?? item.title ?? ''}
      loading={loading}
      decoding="async"
      draggable={draggable}
      onLoad={onLoad}
      onError={handleError}
      className={className}
    />
  );
};
