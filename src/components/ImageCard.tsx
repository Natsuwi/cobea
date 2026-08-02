import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Heart, Maximize2, Trash2, Tag as TagIcon } from 'lucide-react';
import { ImageItem } from '../types';
import { useCardDragPreview, ITEM_DRAG_MIME } from '../hooks/useCardDragPreview';
import { CardDragGhost } from './CardDragGhost';
import { FileCardPreview, isDisplayableImageItem } from './FileCardPreview';

export { ITEM_DRAG_MIME };

interface ImageCardProps {
  image: ImageItem;
  onSelect: (image: ImageItem) => void;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onDragStartItem?: (id: string) => void;
  onDragEndItem?: () => void;
}

export const ImageCard: React.FC<ImageCardProps> = ({
  image,
  onSelect,
  onToggleFavorite,
  onDelete,
  onDragStartItem,
  onDragEndItem,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const { cardRef, preview, isDragging, handleDragStart, suppressClickIfDragged } =
    useCardDragPreview({ onDragStartItem, onDragEndItem });
  const showAsFile = !isDisplayableImageItem(image);
  const [mediaVisible, setMediaVisible] = useState(false);
  const mediaSentinelRef = useRef<HTMLDivElement>(null);

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
        layout={!isDragging}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: isDragging ? 0.35 : 1, y: 0, scale: isDragging ? 0.98 : 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="group relative overflow-hidden rounded-[1.75rem] md:rounded-[2rem] bg-zinc-200/40 dark:bg-zinc-800/40 border border-black/5 dark:border-white/5 transition-shadow duration-500 hover:shadow-2xl hover:shadow-black/10 dark:hover:shadow-black/50"
      >
        <div
          draggable
          onDragStart={(e) => handleDragStart(e, image.id)}
          onClick={(e) => {
            if (isDragging) return;
            suppressClickIfDragged(e);
            onSelect(image);
          }}
          className="cursor-grab active:cursor-grabbing"
        >
          {showAsFile ? (
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
                <div
                  className="w-full bg-zinc-200/60 dark:bg-zinc-800/60 animate-pulse rounded-[2rem]"
                  style={{
                    paddingBottom: `${((1 / (image.aspectRatio || 1.2)) * 100).toFixed(1)}%`,
                  }}
                />
              )}

              {mediaVisible && !hasError ? (
                <img
                  src={image.url}
                  alt={image.title || 'Galerie image'}
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  onLoad={() => setIsLoaded(true)}
                  onError={() => setHasError(true)}
                  className={`w-full h-auto object-cover block transition-transform duration-700 ease-[0.16,1,0.3,1] group-hover:scale-[1.03] ${
                    isLoaded ? 'opacity-100' : 'opacity-0 absolute inset-0'
                  }`}
                />
              ) : null}

              {hasError ? (
                <div className="w-full min-h-[220px] flex flex-col items-center justify-center p-6 bg-zinc-100/50 dark:bg-zinc-900/50 text-zinc-400 text-xs">
                  <span>Image non disponible</span>
                </div>
              ) : null}
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none flex flex-col justify-between p-4 md:p-6">
            <div className="flex items-center justify-between w-full pointer-events-auto">
              {image.tags && image.tags.length > 0 ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold tracking-wider uppercase text-white/95 bg-black/30 dark:bg-black/50 backdrop-blur-xl px-3 py-1 rounded-full border border-white/10 shadow-sm">
                  <TagIcon className="w-3 h-3 text-amber-300" />
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
            {showAsFile ? (
              <FileCardPreview
                title={image.title}
                mimeType={image.mimeType}
                filename={image.filename}
                size="sm"
              />
            ) : (
              !hasError && (
                <img
                  src={image.url}
                  alt=""
                  draggable={false}
                  className="w-full h-full object-cover"
                />
              )
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
