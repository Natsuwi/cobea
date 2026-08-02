import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { ImageItem, isNoteItem, isMoodboardItem } from '../types';
import { ImageCard } from './ImageCard';
import { NoteCard } from './NoteCard';
import { MoodboardCard } from './MoodboardCard';
import { Loader2, Sparkles, UploadCloud } from 'lucide-react';

/** How many cards to mount initially / per scroll page */
const PAGE_SIZE = 24;

interface MasonryGridProps {
  images: ImageItem[];
  allItems: ImageItem[];
  columnCountOverride?: number | null;
  onSelectImage: (image: ImageItem) => void;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
  onDeleteImage: (id: string, e: React.MouseEvent) => void;
  onOpenUpload: () => void;
  onDragStartItem?: (id: string) => void;
  onDragEndItem?: () => void;
}

function GalleryCard({
  item,
  allItems,
  onSelect,
  onToggleFavorite,
  onDelete,
  onDragStartItem,
  onDragEndItem,
}: {
  item: ImageItem;
  allItems: ImageItem[];
  onSelect: (image: ImageItem) => void;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onDragStartItem?: (id: string) => void;
  onDragEndItem?: () => void;
}) {
  if (isMoodboardItem(item)) {
    const referencedItems = (item.moodboardPlacements || [])
      .map((p) => allItems.find((i) => i.id === p.itemId))
      .filter((i): i is ImageItem => !!i);
    return (
      <MoodboardCard
        item={item}
        referencedItems={referencedItems}
        onSelect={onSelect}
        onToggleFavorite={onToggleFavorite}
        onDelete={onDelete}
        onDragStartItem={onDragStartItem}
        onDragEndItem={onDragEndItem}
      />
    );
  }
  if (isNoteItem(item)) {
    return (
      <NoteCard
        item={item}
        onSelect={onSelect}
        onToggleFavorite={onToggleFavorite}
        onDelete={onDelete}
        onDragStartItem={onDragStartItem}
        onDragEndItem={onDragEndItem}
      />
    );
  }
  return (
    <ImageCard
      image={item}
      onSelect={onSelect}
      onToggleFavorite={onToggleFavorite}
      onDelete={onDelete}
      onDragStartItem={onDragStartItem}
      onDragEndItem={onDragEndItem}
    />
  );
}

export const MasonryGrid: React.FC<MasonryGridProps> = ({
  images,
  allItems,
  columnCountOverride,
  onSelectImage,
  onToggleFavorite,
  onDeleteImage,
  onOpenUpload,
  onDragStartItem,
  onDragEndItem,
}) => {
  const listKey = useMemo(() => images.map((i) => i.id).join('\0'), [images]);
  const [visibleCount, setVisibleCount] = useState(() =>
    Math.min(PAGE_SIZE, images.length)
  );
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVisibleCount(Math.min(PAGE_SIZE, images.length));
  }, [listKey, images.length]);

  const visibleImages = useMemo(
    () => images.slice(0, visibleCount),
    [images, visibleCount]
  );
  const hasMore = visibleCount < images.length;

  useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, images.length));
      },
      { root: null, rootMargin: '600px 0px', threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, images.length, visibleCount]);

  const columns = useMemo(() => {
    const count = columnCountOverride || 5;
    const cols: ImageItem[][] = Array.from({ length: count }, () => []);
    visibleImages.forEach((img, idx) => {
      cols[idx % count].push(img);
    });
    return cols;
  }, [visibleImages, columnCountOverride]);

  if (images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
        <div className="w-16 h-16 rounded-3xl bg-zinc-100 dark:bg-zinc-800/60 border border-black/5 dark:border-white/5 flex items-center justify-center mb-4 text-zinc-400 dark:text-zinc-500">
          <Sparkles className="w-8 h-8 stroke-[1.5]" />
        </div>
        <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-1">
          Votre galerie est vide
        </h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-sm mb-6 font-light">
          Ajoutez une image, un lien ou une note écrite pour commencer votre collection.
        </p>
        <button
          type="button"
          onClick={onOpenUpload}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-sm font-medium hover:opacity-90 transition-all duration-200 shadow-lg shadow-black/5"
        >
          <UploadCloud className="w-4 h-4" />
          <span>Ajouter</span>
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1800px] mx-auto px-4 md:px-8 py-6">
      <div
        className="grid gap-4 md:gap-6"
        style={{
          gridTemplateColumns: columnCountOverride
            ? `repeat(${columnCountOverride}, minmax(0, 1fr))`
            : 'repeat(1, minmax(0, 1fr))',
        }}
      >
        {!columnCountOverride ? (
          <div className="contents sm:hidden">
            {renderColumn(
              visibleImages,
              allItems,
              onSelectImage,
              onToggleFavorite,
              onDeleteImage,
              onDragStartItem,
              onDragEndItem
            )}
          </div>
        ) : null}

        {columns.map((columnImages, colIndex) => (
          <div key={`col-${colIndex}`} className="flex flex-col gap-4 md:gap-6">
            <AnimatePresence>
              {columnImages.map((image) => (
                <GalleryCard
                  key={image.id}
                  item={image}
                  allItems={allItems}
                  onSelect={onSelectImage}
                  onToggleFavorite={onToggleFavorite}
                  onDelete={onDeleteImage}
                  onDragStartItem={onDragStartItem}
                  onDragEndItem={onDragEndItem}
                />
              ))}
            </AnimatePresence>
          </div>
        ))}
      </div>

      {hasMore ? (
        <div
          ref={sentinelRef}
          className="flex items-center justify-center gap-2 py-10 text-xs text-zinc-400"
          aria-hidden
        >
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>
            {visibleCount} / {images.length}
          </span>
        </div>
      ) : null}
    </div>
  );
};

function renderColumn(
  images: ImageItem[],
  allItems: ImageItem[],
  onSelectImage: (image: ImageItem) => void,
  onToggleFavorite: (id: string, e: React.MouseEvent) => void,
  onDeleteImage: (id: string, e: React.MouseEvent) => void,
  onDragStartItem?: (id: string) => void,
  onDragEndItem?: () => void
) {
  return (
    <div className="flex flex-col gap-4">
      <AnimatePresence>
        {images.map((img) => (
          <GalleryCard
            key={img.id}
            item={img}
            allItems={allItems}
            onSelect={onSelectImage}
            onToggleFavorite={onToggleFavorite}
            onDelete={onDeleteImage}
            onDragStartItem={onDragStartItem}
            onDragEndItem={onDragEndItem}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
