import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Heart, Maximize2, Trash2, Tag as TagIcon, Play } from 'lucide-react';
import { ImageItem } from '../types';
import { useCardDragPreview, ITEM_DRAG_MIME } from '../hooks/useCardDragPreview';
import { CardDragGhost } from './CardDragGhost';
import { FileCardPreview, isDisplayableImageItem, isVideoItem } from './FileCardPreview';
import { RefreshableThumb } from './RefreshableThumb';
import { CardThumbPlaceholder } from './CardThumbPlaceholder';
import { WebLinkCardPreview } from './WebLinkCardPreview';
import { CardKindBadge } from './CardKindBadge';
import { CobeaLogoMark } from './CobeaBrand';
import { externalUrlForCard, isWebPageKind } from '../lib/cardKinds';
import { useIsMobileViewport } from '../hooks/useIsMobileViewport';

export { ITEM_DRAG_MIME };

interface ImageCardProps {
  image: ImageItem;
  onSelect: (image: ImageItem) => void;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onDragStartItem?: (id: string) => void;
  onDragEndItem?: () => void;
  onCardUpdated?: (card: ImageItem) => void;
}

export const ImageCard: React.FC<ImageCardProps> = ({
  image,
  onSelect,
  onToggleFavorite,
  onDelete,
  onDragStartItem,
  onDragEndItem,
  onCardUpdated,
}) => {
  const isMobile = useIsMobileViewport();
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const { cardRef, preview, isDragging, handleDragStart, suppressClickIfDragged } =
    useCardDragPreview({ onDragStartItem, onDragEndItem });
  const showAsWebLink = isWebPageKind(image.kind) && Boolean(externalUrlForCard(image.url));
  const showAsFile = !isDisplayableImageItem(image) && !showAsWebLink;
  const showVideoBadge = !showAsFile && !showAsWebLink && isVideoItem(image);
  const externalUrl = externalUrlForCard(image.url);
  const [mediaVisible, setMediaVisible] = useState(false);
  const mediaSentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsLoaded(false);
    setHasError(false);
  }, [image.id, image.url]);

  useEffect(() => {
    if (showAsFile || mediaVisible) return;
    const el = mediaSentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setMediaVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: '200px 0px', threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [showAsFile, mediaVisible, image.id]);

  return (
    <>
      <motion.div
        ref={cardRef}
        layout={false}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: isDragging ? 0.35 : 1, y: 0, scale: isDragging ? 0.98 : 1 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="group relative overflow-hidden rounded-[1.75rem] md:rounded-[2rem] bg-zinc-200/40 dark:bg-zinc-800/40 border border-black/5 dark:border-white/5 transition-shadow duration-500 hover:shadow-2xl hover:shadow-black/10 dark:hover:shadow-black/50"
      >
        <div className="absolute top-2.5 left-2.5 z-20 pointer-events-none">
          <CardKindBadge kind={image.kind} />
        </div>

        <div
          draggable={!isMobile}
          onDragStart={
            isMobile ? undefined : (e) => handleDragStart(e, image.id)
          }
          onClick={(e) => {
            if (isDragging) return;
            suppressClickIfDragged(e);
            if (e.defaultPrevented) return;
            onSelect(image);
          }}
          className={isMobile ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'}
        >
          {showAsWebLink && externalUrl ? (
            <div
              className="w-full"
              style={{
                aspectRatio: String(image.aspectRatio || 0.85),
              }}
            >
              <WebLinkCardPreview
                title={image.title}
                url={externalUrl}
                size="md"
                className="rounded-[2rem]"
              />
            </div>
          ) : showAsFile ? (
            <div
              className="w-full"
              style={{
                aspectRatio: String(image.aspectRatio || 0.85),
              }}
            >
              <FileCardPreview
                title={image.title}
                mimeType={image.mimeType}
                filename={image.filename}
                size="md"
                className="rounded-[2rem]"
              />
            </div>
          ) : (
            <div ref={mediaSentinelRef} className="relative w-full">
              {!isLoaded && !hasError && (
                <CardThumbPlaceholder
                  aspectRatio={image.aspectRatio || 1.2}
                  className="rounded-[2rem]"
                />
              )}

              {(mediaVisible || image.uploadPending) && !hasError ? (
                <RefreshableThumb
                  item={image}
                  onLoad={() => setIsLoaded(true)}
                  onCardUpdated={onCardUpdated}
                  onFailed={() => setHasError(true)}
                  className={`w-full h-auto object-cover block transition-transform duration-700 ease-[0.16,1,0.3,1] group-hover:scale-[1.03] ${
                    isLoaded ? 'opacity-100' : 'opacity-0 absolute inset-0'
                  }`}
                />
              ) : null}

              {showVideoBadge && isLoaded && !hasError ? (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/55 text-white shadow-lg backdrop-blur-sm ring-1 ring-white/20">
                    <Play className="h-5 w-5 fill-current ml-0.5" />
                  </span>
                </div>
              ) : null}

              {image.uploadPending ? (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/20">
                  <CobeaLogoMark
                    className="w-10 h-10 text-white/80 animate-pulse drop-shadow-md"
                    title="Upload en cours"
                  />
                </div>
              ) : null}

              {hasError ? (
                <div
                  className="w-full"
                  style={{ aspectRatio: String(image.aspectRatio || 0.85) }}
                >
                  <FileCardPreview
                    title={image.title}
                    mimeType={image.mimeType}
                    filename={image.filename}
                    size="md"
                    className="rounded-[2rem]"
                  />
                </div>
              ) : null}
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 md:group-hover:opacity-100 transition-all duration-300 pointer-events-none flex flex-col justify-between p-4 md:p-6">
            <div className="flex items-center justify-between w-full pointer-events-auto">
              {image.tags && image.tags.length > 0 ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold tracking-wider uppercase text-white/95 bg-black/30 dark:bg-black/50 backdrop-blur-xl px-3 py-1 rounded-full border border-white/10 shadow-sm">
                  <TagIcon className="w-3 h-3 text-accent-hover" />
                  {image.tags[0]}
                </span>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={(e) => onToggleFavorite(image.id, e)}
                  className={`p-2.5 rounded-full transition-all duration-300 ${
                    image.isFavorite
                      ? 'bg-rose-500 text-white shadow-md'
                      : 'bg-black/30 dark:bg-black/50 backdrop-blur-xl text-white hover:bg-white hover:text-zinc-950 hover:scale-110'
                  }`}
                  title={image.isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                >
                  <Heart
                    className={`w-3.5 h-3.5 ${image.isFavorite ? 'fill-current' : ''}`}
                  />
                </button>

                <button
                  type="button"
                  onClick={(e) => onDelete(image.id, e)}
                  className="p-2.5 rounded-full bg-black/30 dark:bg-black/50 backdrop-blur-xl text-white/90 hover:text-rose-400 hover:bg-black/60 transition-all duration-300 hover:scale-110"
                  title="Supprimer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex items-end justify-between w-full pointer-events-auto">
              <div className="max-w-[80%] space-y-0.5">
                <h4 className="text-sm font-medium text-white tracking-tight truncate">
                  {image.title || 'Sans titre'}
                </h4>
                <p className="text-[11px] text-white/70 tracking-wide font-normal">
                  {new Date(image.createdAt).toLocaleDateString('fr-FR', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
              </div>

              <button
                type="button"
                className="p-2.5 rounded-full bg-black/30 dark:bg-black/50 backdrop-blur-xl text-white hover:bg-white hover:text-zinc-950 transition-all duration-300"
                title="Agrandir"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {preview && (
        <CardDragGhost preview={preview}>
          <div className="relative w-full h-full bg-zinc-200 dark:bg-zinc-800">
            {showAsFile || hasError ? (
              <FileCardPreview
                title={image.title}
                mimeType={image.mimeType}
                filename={image.filename}
                size="sm"
              />
            ) : (
              <img
                src={image.url}
                alt=""
                draggable={false}
                className="w-full h-full object-cover"
              />
            )}
            <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/70 to-transparent">
              <p className="text-[11px] font-medium text-white truncate">
                {image.title || 'Sans titre'}
              </p>
            </div>
          </div>
        </CardDragGhost>
      )}
    </>
  );
};
