import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Folder } from '../types';
import { FolderIcon } from '../lib/folderIcons';

interface FolderDropZoneProps {
  folder: Folder | null;
  isVisible: boolean;
  isOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}

export const FolderDropZone: React.FC<FolderDropZoneProps> = ({
  folder,
  isVisible,
  isOver,
  onDragOver,
  onDragLeave,
  onDrop,
}) => {
  return (
    <AnimatePresence>
      {isVisible && folder && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.95 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[45] pointer-events-auto"
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <div
            className={`w-[280px] sm:w-[320px] rounded-2xl border-2 border-dashed px-6 py-8 flex flex-col items-center text-center gap-3 transition-all duration-200 backdrop-blur-xl ${
              isOver
                ? 'border-amber-400 bg-amber-400/15 dark:bg-amber-400/20 scale-105 shadow-xl shadow-amber-400/20'
                : 'border-zinc-400/60 dark:border-zinc-500/50 bg-white/90 dark:bg-zinc-900/90 shadow-2xl shadow-black/10'
            }`}
          >
            <motion.div
              animate={isOver ? { scale: [1, 1.08, 1] } : { scale: 1 }}
              transition={{ duration: 0.6, repeat: isOver ? Infinity : 0 }}
              className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                isOver
                  ? 'bg-amber-400 text-zinc-950'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'
              }`}
            >
              <FolderIcon name={folder.icon} className="w-7 h-7 stroke-[1.5]" />
            </motion.div>
            <div>
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {isOver ? 'Déposez ici' : `Déposer dans « ${folder.name} »`}
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                Glissez une image ou une note
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
