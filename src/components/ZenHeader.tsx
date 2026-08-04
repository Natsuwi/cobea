import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeftRight, Heart, Menu, Plus, Sparkles, X } from 'lucide-react';
import { Folder, UserProfile } from '../types';
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
  profile: UserProfile;
  showAccountControls?: boolean;
  onOpenAccount: () => void;
  onSwitchAccounts: () => void;
}

export const ZenHeader: React.FC<ZenHeaderProps> = ({
  selectedFolderId,
  onSelectFolder,
  folders,
  isFavoriteFilterActive,
  onToggleFavoriteFilter,
  zenMode,
  onOpenUpload,
  profile,
  showAccountControls = true,
  onOpenAccount,
  onSwitchAccounts,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    const onPointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  if (zenMode) return null;

  const selectGallery = () => {
    onSelectFolder(null);
    if (isFavoriteFilterActive) onToggleFavoriteFilter();
    setMenuOpen(false);
  };

  const selectFavorites = () => {
    onToggleFavoriteFilter();
    setMenuOpen(false);
  };

  const selectFolder = (folderId: string) => {
    onSelectFolder(folderId === selectedFolderId ? null : folderId);
    setMenuOpen(false);
  };

  const openUpload = () => {
    setMenuOpen(false);
    onOpenUpload();
  };

  const isGalleryActive = selectedFolderId === null && !isFavoriteFilterActive;

  const navButtonClass = (active: boolean, favorite = false) =>
    `w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 flex items-center gap-2 text-left ${
      active
        ? favorite
          ? 'bg-rose-500 text-white shadow-sm'
          : 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-sm'
        : 'text-zinc-700 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/10'
    }`;

  return (
    <header className="w-full pt-6 pb-2 px-4 md:px-8 max-w-[1800px] mx-auto flex flex-col items-center text-center space-y-6 transition-all duration-300">
      {/* Desktop nav */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="hidden md:flex glass-panel rounded-full px-4 py-2 items-center justify-between gap-4 md:gap-8 shadow-lg shadow-black/5 max-w-full overflow-x-auto no-scrollbar"
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
            onClick={selectGallery}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
              isGalleryActive
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-black/5 dark:hover:bg-white/10'
            }`}
          >
            Galerie
          </button>

          <button
            type="button"
            onClick={() => onToggleFavoriteFilter()}
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

      {/* Mobile nav: brand + menu + account */}
      <motion.div
        ref={menuRef}
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative md:hidden w-full"
      >
        <div className="glass-panel rounded-full pl-3 pr-1.5 py-1.5 w-full flex items-center justify-between gap-2 shadow-lg shadow-black/5">
          <div className="flex items-center px-1.5 py-0.5 min-w-0">
            <CobeaBrand
              markClassName="w-6 h-6 text-zinc-900 dark:text-zinc-50 shrink-0"
              textClassName="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100"
            />
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="p-2 rounded-full text-zinc-700 dark:text-zinc-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              aria-expanded={menuOpen}
              aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            {showAccountControls && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onSwitchAccounts();
                  }}
                  title="Changer de compte"
                  className="flex items-center justify-center p-2 rounded-full text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5 stroke-[1.5]" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenAccount();
                  }}
                  title={`${profile.name} — paramètres`}
                  className="group focus:outline-none p-0.5"
                >
                  <span className="block w-8 h-8 rounded-full overflow-hidden ring-2 ring-white/90 dark:ring-zinc-800 shadow-md border border-black/5 dark:border-white/10 transition-transform duration-300 group-hover:scale-105 group-active:scale-95">
                    {profile.avatarUrl ? (
                      <img
                        src={profile.avatarUrl}
                        alt={profile.name}
                        className="w-full h-full object-cover"
                        draggable={false}
                      />
                    ) : (
                      <span className="w-full h-full flex items-center justify-center avatar-accent-gradient text-white text-xs font-semibold">
                        {profile.name.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                  </span>
                </button>
              </>
            )}
          </div>
        </div>

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="absolute left-0 right-0 top-full mt-2 z-50 glass-panel rounded-2xl p-2 shadow-xl shadow-black/10 border border-black/5 dark:border-white/10 text-left"
            >
              <div className="flex flex-col gap-0.5 max-h-[min(60vh,420px)] overflow-y-auto">
                <button
                  type="button"
                  onClick={selectGallery}
                  className={navButtonClass(isGalleryActive)}
                >
                  Galerie
                </button>

                <button
                  type="button"
                  onClick={selectFavorites}
                  className={navButtonClass(isFavoriteFilterActive, true)}
                >
                  <Heart
                    className={`w-3.5 h-3.5 ${isFavoriteFilterActive ? 'fill-current' : ''}`}
                  />
                  Favoris
                </button>

                {folders.map((folder) => (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => selectFolder(folder.id)}
                    className={navButtonClass(selectedFolderId === folder.id)}
                  >
                    <FolderIcon name={folder.icon} className="w-3.5 h-3.5 stroke-[1.75]" />
                    <span className="truncate">{folder.name}</span>
                  </button>
                ))}
              </div>

              <div className="mt-2 pt-2 border-t border-zinc-200/80 dark:border-white/10">
                <button
                  type="button"
                  onClick={openUpload}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 text-sm font-medium hover:opacity-90 active:scale-[0.98] transition-all shadow-sm"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  Ajouter
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <div className="pt-4 pb-2 max-w-xl mx-auto space-y-3">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-white/80 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-300 border border-black/5 dark:border-white/10 shadow-sm"
        >
          <Sparkles className="w-3 h-3 text-accent fill-accent/20" />
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
