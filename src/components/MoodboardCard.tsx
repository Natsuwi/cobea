import React from 'react';
import { motion } from 'motion/react';
import { Heart, Trash2, LayoutGrid } from 'lucide-react';
import { ImageItem, isNoteItem } from '../types';
import { useCardDragPreview } from '../hooks/useCardDragPreview';
import { CardDragGhost } from './CardDragGhost';
import { MarkdownPreview } from './MarkdownPreview';
import { FileCardPreview, isDisplayableImageItem } from './FileCardPreview';

interface MoodboardCardProps {
  item: ImageItem;
  referencedItems: ImageItem[];
  onSelect: (item: ImageItem) => void;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onDragStartItem?: (id: string) => void;
  onDragEndItem?: () => void;
}

export const MoodboardCard: React.FC<MoodboardCardProps> = ({
  item,
  referencedItems,
  onSelect,
  onToggleFavorite,
  onDelete,
  onDragStartItem,
  onDragEndItem,
}) => {
  const { cardRef, preview, isDragging, handleDragStart, suppressClickIfDragged } =
    useCardDragPreview({ onDragStartItem, onDragEndItem });

  const previewItems = referencedItems.slice(0, 4);

  return (
    <>
      <motion.div
        ref={cardRef}
        layout={!isDragging}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: isDragging ? 0.35 : 1, y: 0, scale: isDragging ? 0.98 : 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="group relative overflow-hidden rounded-[1.75rem] md:rounded-[2rem] bg-zinc-100 dark:bg-zinc-800/60 border border-black/5 dark:border-white/5 transition-shadow duration-500 hover:shadow-2xl hover:shadow-black/10 dark:hover:shadow-black/50"
      >
        <div
          draggable
          onDragStart={(e) => handleDragStart(e, item.id)}
          onClick={(e) => {
            if (isDragging) return;
            suppressClickIfDragged(e);
            onSelect(item);
          }}
          className="cursor-grab active:cursor-grabbing"
        >
          <div
            className="relative w-full moodboard-canvas-bg"
            style={{ paddingBottom: `${((1 / (item.aspectRatio || 1.35)) * 100).toFixed(1)}%` }}
          >
            <div className="absolute inset-0 flex items-center justify-center p-6">
              {previewItems.length === 0 ? (
                <LayoutGrid className="w-10 h-10 text-zinc-600" />
              ) : (
                <div className="relative w-full max-w-[200px] h-[120px]">
                  {previewItems.map((ref, idx) => {
                    const offset = idx * 18;
                    const rotation = (idx - previewItems.length / 2) * 6;
                    return (
                      <div
                        key={ref.id}
                        className="absolute bottom-0 left-1/2 w-[72px] h-[96px] rounded-lg overflow-hidden border-2 border-white dark:border-zinc-700 shadow-md"
                        style={{
                          transform: `translateX(calc(-50% + ${offset - (previewItems.length - 1) * 9}px)) rotate(${rotation}deg)`,
                          zIndex: idx,
                        }}
                      >
                        {isNoteItem(ref) ? (
                          <div className="w-full h-full p-1 bg-white dark:bg-zinc-900 text-[5px] overflow-hidden">
                            <MarkdownPreview content={ref.markdown || ''} />
                          </div>
                        ) : isDisplayableImageItem(ref) && ref.url ? (
                          <img
                            src={ref.url}
                            alt=""
                            className="w-full h-full object-cover"
                            draggable={false}
                          />
                        ) : (
                          <FileCardPreview
                            title={ref.title}
                            mimeType={ref.mimeType}
                            filename={ref.filename}
                            size="sm"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none flex flex-col justify-between p-4 md:p-6">
            <div className="flex justify-between items-start pointer-events-auto">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/15 backdrop-blur-sm text-[10px] font-medium text-white">
                <LayoutGrid className="w-3 h-3" />
                Moodboard
              </span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={(e) => onToggleFavorite(item.id, e)}
                  className="p-2 rounded-full bg-black/30 backdrop-blur-md text-white hover:bg-black/50 transition-colors"
                >
                  <Heart
                    className={`w-3.5 h-3.5 ${item.isFavorite ? 'fill-rose-400 text-rose-400' : ''}`}
                  />
                </button>
                <button
                  type="button"
                  onClick={(e) => onDelete(item.id, e)}
                  className="p-2 rounded-full bg-black/30 backdrop-blur-md text-white hover:bg-rose-500/80 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="pointer-events-none">
              <h4 className="text-white text-sm font-medium truncate">{item.title}</h4>
              <p className="text-white/60 text-[10px] mt-0.5">
                {referencedItems.length} carte{referencedItems.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {preview && (
        <CardDragGhost preview={preview}>
          <div className="relative w-full h-full moodboard-canvas-bg flex items-center justify-center p-3">
            {previewItems.length === 0 ? (
              <LayoutGrid className="w-7 h-7 text-zinc-500" />
            ) : (
              <div className="relative w-full max-w-[120px] h-[72px]">
                {previewItems.map((ref, idx) => {
                  const offset = idx * 12;
                  const rotation = (idx - previewItems.length / 2) * 6;
                  return (
                    <div
                      key={ref.id}
                      className="absolute bottom-0 left-1/2 w-[44px] h-[58px] rounded-md overflow-hidden border-2 border-white dark:border-zinc-700 shadow-md"
                      style={{
                        transform: `translateX(calc(-50% + ${offset - (previewItems.length - 1) * 6}px)) rotate(${rotation}deg)`,
                        zIndex: idx,
                      }}
                    >
                      {isNoteItem(ref) ? (
                        <div className="w-full h-full p-0.5 bg-white dark:bg-zinc-900 text-[4px] overflow-hidden">
                          <MarkdownPreview content={ref.markdown || ''} />
                        </div>
                      ) : isDisplayableImageItem(ref) && ref.url ? (
                        <img
                          src={ref.url}
                          alt=""
                          className="w-full h-full object-cover"
                          draggable={false}
                        />
                      ) : (
                        <FileCardPreview
                          title={ref.title}
                          mimeType={ref.mimeType}
                          filename={ref.filename}
                          size="sm"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/65 to-transparent">
              <p className="text-[11px] font-medium text-white truncate">{item.title}</p>
            </div>
          </div>
        </CardDragGhost>
      )}
    </>
  );
};
