import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Folder, LayoutGrid, X } from 'lucide-react';
import { ImageItem, isNoteItem } from '../types';
import { FolderPicker } from './FolderPicker';
import { Folder as FolderType } from '../types';
import { ITEM_DRAG_MIME } from '../hooks/useCardDragPreview';
import { MarkdownPreview } from './MarkdownPreview';
import { FileCardPreview, isDisplayableImageItem } from './FileCardPreview';

const CARD_W = 64;
const CARD_H = 104;

interface CardSelectionDockProps {
  isVisible: boolean;
  selectedIds: string[];
  items: ImageItem[];
  isDragActive: boolean;
  isApproaching: boolean;
  isOver: boolean;
  folders: FolderType[];
  folderItemCounts: Record<string, number>;
  onCreateFolder: (name: string, icon: string) => void;
  onAssignFolder: (folderId: string) => void;
  onCreateMoodboard: () => void;
  onRemoveItem: (id: string) => void;
  onClear: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}

function DeckCardPreview({ item, index, total }: { item: ImageItem; index: number; total: number }) {
  const offset = index * 18;
  const rotation = (index - (total - 1) / 2) * 5;

  return (
    <div
      className="selection-deck-card absolute left-1/2"
      style={{
        width: CARD_W,
        height: CARD_H,
        top: `calc(50% - ${CARD_H / 2}px)`,
        transform: `translateX(calc(-50% + ${offset - (total - 1) * 9}px)) rotate(${rotation}deg)`,
        zIndex: index,
      }}
    >
      <div className="w-full h-full rounded-xl overflow-hidden border-2 border-white dark:border-zinc-800 shadow-lg bg-white dark:bg-zinc-900">
        {isNoteItem(item) ? (
          <div className="w-full h-full p-1.5 text-[6px] leading-tight text-zinc-600 dark:text-zinc-300 overflow-hidden">
            <MarkdownPreview content={item.markdown || ''} className="line-clamp-6" />
          </div>
        ) : isDisplayableImageItem(item) && item.url ? (
          <img src={item.url} alt="" className="w-full h-full object-cover" draggable={false} />
        ) : (
          <FileCardPreview
            title={item.title}
            mimeType={item.mimeType}
            filename={item.filename}
            size="sm"
          />
        )}
      </div>
    </div>
  );
}

export const CardSelectionDock: React.FC<CardSelectionDockProps> = ({
  isVisible,
  selectedIds,
  items,
  isDragActive,
  isApproaching,
  isOver,
  folders,
  folderItemCounts,
  onCreateFolder,
  onAssignFolder,
  onCreateMoodboard,
  onRemoveItem,
  onClear,
  onDragOver,
  onDragLeave,
  onDrop,
}) => {
  const [isFolderPickerOpen, setIsFolderPickerOpen] = useState(false);

  const selectedItems = selectedIds
    .map((id) => items.find((i) => i.id === id))
    .filter((i): i is ImageItem => !!i);

  const visibleDeck = selectedItems.slice(-10);
  const isRaised = isApproaching || isOver;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className={`selection-dock-clip fixed inset-x-0 bottom-0 z-[55] pointer-events-none ${
            isFolderPickerOpen ? 'overflow-visible' : 'overflow-hidden'
          } ${isRaised ? 'selection-dock-clip--raised' : ''}`}
        >
          <div className="selection-dock-inner pointer-events-auto">
            <div className="selection-dock-curtain" aria-hidden />
            <div className="relative z-[1] flex flex-1 min-h-0 items-stretch gap-3 px-4 sm:px-8 pt-4 pb-3">
              {/* Wide dotted drop zone */}
              <div
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                className={`selection-dock-dropzone relative z-0 flex-1 min-w-0 min-h-0 rounded-t-3xl border-2 border-b-0 border-dashed transition-all duration-200 ${
                  isOver
                    ? 'selection-dock-dropzone--over'
                    : isDragActive
                      ? 'selection-dock-dropzone--active'
                      : ''
                }`}
              >
                <div className="selection-dock-glass absolute inset-0 rounded-t-3xl" aria-hidden />
                <div className="relative z-[1] w-full h-full min-h-0">
                {selectedItems.length === 0 ? (
                  <p className="absolute inset-x-0 top-3 text-center text-xs text-zinc-500 dark:text-zinc-400 font-medium px-4 z-[2]">
                    {isDragActive ? 'Déposer ici' : 'Glissez des cartes ici'}
                  </p>
                ) : (
                  <div className="relative w-full h-full min-h-0">
                    {visibleDeck.map((item, idx) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onRemoveItem(item.id)}
                        className="group"
                        title="Retirer de la sélection"
                      >
                        <DeckCardPreview item={item} index={idx} total={visibleDeck.length} />
                      </button>
                    ))}
                    {selectedItems.length > 10 && (
                      <span className="absolute top-2 right-3 text-[10px] font-medium text-zinc-400">
                        +{selectedItems.length - 10}
                      </span>
                    )}
                  </div>
                )}
                </div>
              </div>

              {/* Action buttons — right of the dock */}
              {selectedItems.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="relative z-30 flex shrink-0 items-center gap-2 self-start pt-1"
                >
                  <div className="relative z-30">
                    <button
                      type="button"
                      onClick={() => setIsFolderPickerOpen((v) => !v)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/10 shadow-xl hover:scale-105 transition-transform text-sm font-medium text-zinc-800 dark:text-zinc-100"
                      title="Assigner à un dossier"
                    >
                      <Folder className="w-4 h-4 text-amber-500" />
                      <span className="hidden sm:inline">Dossier</span>
                    </button>
                    <FolderPicker
                      isOpen={isFolderPickerOpen}
                      onClose={() => setIsFolderPickerOpen(false)}
                      folders={folders}
                      dropTargetFolderId={null}
                      onSelectFolder={(folderId) => {
                        if (folderId) {
                          onAssignFolder(folderId);
                          setIsFolderPickerOpen(false);
                        }
                      }}
                      onCreateFolder={onCreateFolder}
                      itemCounts={folderItemCounts}
                      assignMode
                      onAssignFolder={(folderId) => {
                        onAssignFolder(folderId);
                        setIsFolderPickerOpen(false);
                      }}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={onCreateMoodboard}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xl hover:scale-105 transition-transform text-sm font-medium"
                    title="Créer un moodboard"
                  >
                    <LayoutGrid className="w-4 h-4" />
                    <span className="hidden sm:inline">Moodboard</span>
                  </button>

                  <button
                    type="button"
                    onClick={onClear}
                    className="p-2.5 rounded-2xl bg-white/90 dark:bg-zinc-900/90 border border-black/10 dark:border-white/10 shadow-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                    title="Vider la sélection"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export function getDraggedItemId(e: React.DragEvent): string | null {
  return e.dataTransfer.getData(ITEM_DRAG_MIME) || e.dataTransfer.getData('text/plain') || null;
}
