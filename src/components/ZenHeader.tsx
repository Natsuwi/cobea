import React from 'react';
import { motion } from 'motion/react';
import { Sparkles, Heart, Plus } from 'lucide-react';
import { Folder } from '../types';
import { FolderIcon } from '../lib/folderIcons';
import { CobeaBrand } from './CobeaBrand';

interface ZenHeaderProps {
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  folders: Folder[];
  isFavoriteFilterActive: boolean;
  onToggleFavoriteFilter: () => void;
  zenMode: boolean;
  onOpenUpload: () => void;
}

export const ZenHeader: React.FC<ZenHeaderProps> = ({
  selectedFolderId,
  onSelectFolder,
  folders,
  isFavoriteFilterActive,
  onToggleFavoriteFilter,
  zenMode,
  onOpenUpload,
}) => {
  if (zenMode) return null;

  return (
    <header className="w-full pt-6 pb-2 px-4 md:px-8 max-w-[1800px] mx-auto flex flex-col items-center text-center space-y-6 transition-all duration-300">
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="glass-panel rounded-full px-4 py-2 flex items-center justify-between gap-4 md:gap-8 shadow-lg shadow-black/5 max-w-full overflow-x-auto no-scrollbar"
      >
        <div className="flex items-center px-2 py-1">
          <CobeaBrand
            markClassName="w-6 h-6 text-zinc-900 dark:text-zinc-50"
            textClassName="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100"
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => {
              onSelectFolder(null);
              if (isFavoriteFilterActive) onToggleFavoriteFilter();
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
              selectedFolderId === null && !isFavoriteFilterActive
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-black/5 dark:hover:bg-white/10'
            }`}
          >
            Galerie
          </button>

          <button
            type="button"
            onClick={onToggleFavoriteFilter}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 flex items-center gap-1.5 ${
              isFavoriteFilterActive
                ? 'bg-rose-500 text-white shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-black/5 dark:hover:bg-white/10'
            }`}
          >
            <Heart className={`w-3 h-3 ${isFavoriteFilterActive ? 'fill-current' : ''}`} />
            <span>Favoris</span>
          </button>

          {folders.map((folder) => (
            <button
              key={folder.id}
              type="button"
              onClick={() =>
                onSelectFolder(folder.id === selectedFolderId ? null : folder.id)
              }
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 flex items-center gap-1.5 ${
                selectedFolderId === folder.id
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-black/5 dark:hover:bg-white/10'
              }`}
            >
              <FolderIcon name={folder.icon} className="w-3 h-3 stroke-[1.75]" />
              <span>{folder.name}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onOpenUpload}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 text-xs font-medium hover:scale-105 active:scale-95 transition-all duration-200 shadow-sm whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Ajouter</span>
        </button>
      </motion.div>

      <div className="pt-4 pb-2 max-w-xl mx-auto space-y-3">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-white/80 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-300 border border-black/5 dark:border-white/10 shadow-sm"
        >
          <Sparkles className="w-3 h-3 text-amber-500 fill-amber-500/20" />
          <span>Glissez n'importe quelle image pour commencer</span>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
        >
          Design with ease.
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 font-normal leading-relaxed max-w-md mx-auto"
        >
          Un espace de calme et de beauté visuelle. Organisez vos inspirations et photos préférées dans un confort absolu.
        </motion.p>
      </div>
    </header>
  );
};
