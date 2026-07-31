import React from 'react';
import { motion } from 'motion/react';
import { Heart, Trash2, FileText, Tag as TagIcon } from 'lucide-react';
import { ImageItem } from '../types';
import { MarkdownPreview } from './MarkdownPreview';
import { useCardDragPreview } from '../hooks/useCardDragPreview';
import { CardDragGhost } from './CardDragGhost';

interface NoteCardProps {
  item: ImageItem;
  onSelect: (item: ImageItem) => void;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onDragStartItem?: (id: string) => void;
  onDragEndItem?: () => void;
}

export const NoteCard: React.FC<NoteCardProps> = ({
  item,
  onSelect,
  onToggleFavorite,
  onDelete,
  onDragStartItem,
  onDragEndItem,
}) => {
  const { cardRef, preview, isDragging, handleDragStart, suppressClickIfDragged } =
    useCardDragPreview({ onDragStartItem, onDragEndItem });

  return (
    <>
      <motion.div
        ref={cardRef}
        layout={!isDragging}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: isDragging ? 0.35 : 1, y: 0, scale: isDragging ? 0.98 : 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="group relative overflow-hidden rounded-[1.75rem] md:rounded-[2rem] bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/5 transition-shadow duration-500 hover:shadow-2xl hover:shadow-black/10 dark:hover:shadow-black/50"
      >
        <div
          draggable
          onDragStart={(e) => handleDragStart(e, item.id)}
          onClick={(e) => {
            if (isDragging) return;
            suppressClickIfDragged(e);
            onSelect(item);
          }}
          className="cursor-grab active:cursor-grabbing p-5 md:p-6 space-y-3 min-h-[160px]"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-wider uppercase text-amber-700/80 dark:text-amber-300/90 bg-amber-500/10 px-2.5 py-1 rounded-full">
              <FileText className="w-3 h-3" />
              Note
            </span>

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={(e) => onToggleFavorite(item.id, e)}
                className={`p-2 rounded-full transition-all ${
                  item.isFavorite
                    ? 'bg-rose-500 text-white'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
                title={item.isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              >
                <Heart className={`w-3.5 h-3.5 ${item.isFavorite ? 'fill-current' : ''}`} />
              </button>
              <button
                type="button"
                onClick={(e) => onDelete(item.id, e)}
                className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-rose-500 transition-all"
                title="Supprimer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {item.title && (
            <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 tracking-tight line-clamp-2">
              {item.title}
            </h4>
          )}

          <div className="max-h-48 overflow-hidden relative">
            <MarkdownPreview content={item.markdown || ''} compact />
            <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white dark:from-zinc-900 to-transparent pointer-events-none" />
          </div>

          <div className="flex items-center justify-between pt-1">
            <p className="text-[11px] text-zinc-400 tracking-wide">
              {new Date(item.createdAt).toLocaleDateString('fr-FR', {
                month: 'short',
                day: 'numeric',
              })}
            </p>
            {item.tags && item.tags.length > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] text-zinc-400">
                <TagIcon className="w-3 h-3" />
                {item.tags[0]}
              </span>
            )}
          </div>
        </div>
      </motion.div>

      {preview && (
        <CardDragGhost preview={preview}>
          <div className="w-full h-full bg-white dark:bg-zinc-900 p-3.5 space-y-2 overflow-hidden">
            <span className="inline-flex items-center gap-1 text-[9px] font-semibold tracking-wider uppercase text-amber-700/80 dark:text-amber-300/90 bg-amber-500/10 px-2 py-0.5 rounded-full">
              <FileText className="w-2.5 h-2.5" />
              Note
            </span>
            {item.title && (
              <h4 className="text-xs font-medium text-zinc-900 dark:text-zinc-100 tracking-tight line-clamp-2">
                {item.title}
              </h4>
            )}
            <div className="max-h-24 overflow-hidden relative opacity-80 scale-[0.92] origin-top-left">
              <MarkdownPreview content={item.markdown || ''} compact />
            </div>
          </div>
        </CardDragGhost>
      )}
    </>
  );
};
