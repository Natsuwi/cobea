import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Search, Eye, X, Sparkles } from 'lucide-react';
import { useIsMobileViewport } from '../hooks/useIsMobileViewport';

interface BottomNavbarProps {
  onOpenUpload: () => void;
  searchQuery: string;
  onSearchChange: (query: string | ((prev: string) => string)) => void;
  activeTagFilters: string[];
  onCommitTagFilter: (tag: string) => void;
  onRemoveTagFilter: (tag: string) => void;
  zenMode: boolean;
  onToggleZenMode: () => void;
  totalImagesCount: number;
  /** Slide navbar down when card selection dock is active */
  hiddenForSelection?: boolean;
  /** Disable type-to-search (e.g. while a modal is open) */
  typeToSearchEnabled?: boolean;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return Boolean(target.closest('[contenteditable="true"], input, textarea, select'));
}

export const BottomNavbar: React.FC<BottomNavbarProps> = ({
  onOpenUpload,
  searchQuery,
  onSearchChange,
  activeTagFilters,
  onCommitTagFilter,
  onRemoveTagFilter,
  zenMode,
  onToggleZenMode,
  totalImagesCount,
  hiddenForSelection = false,
  typeToSearchEnabled = true,
}) => {
  const isMobile = useIsMobileViewport();
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const mobileSearchInputRef = React.useRef<HTMLInputElement>(null);
  const [searchDrawerOpen, setSearchDrawerOpen] = React.useState(false);

  /** Desktop: expand when query is non-empty */
  const isDesktopSearchOpen = !isMobile && searchQuery.length > 0;

  React.useEffect(() => {
    if (!isMobile) setSearchDrawerOpen(false);
  }, [isMobile]);

  React.useEffect(() => {
    if (hiddenForSelection || zenMode) setSearchDrawerOpen(false);
  }, [hiddenForSelection, zenMode]);

  React.useEffect(() => {
    if (isDesktopSearchOpen) {
      searchInputRef.current?.focus();
    }
  }, [isDesktopSearchOpen]);

  React.useEffect(() => {
    if (searchDrawerOpen) {
      const id = window.setTimeout(() => mobileSearchInputRef.current?.focus(), 80);
      return () => window.clearTimeout(id);
    }
  }, [searchDrawerOpen]);

  /** Type-to-search from the main gallery view (desktop / keyboard) */
  React.useEffect(() => {
    if (zenMode || hiddenForSelection || !typeToSearchEnabled) return;
    if (isMobile) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;

      if (e.key === 'Escape') {
        if (isDesktopSearchOpen) {
          onSearchChange('');
          e.preventDefault();
        }
        return;
      }

      if (e.key === 'Backspace' && isDesktopSearchOpen) {
        e.preventDefault();
        onSearchChange((prev) => (prev.length > 0 ? prev.slice(0, -1) : prev));
        return;
      }

      if (e.key.length === 1) {
        e.preventDefault();
        onSearchChange((prev) => prev + e.key);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    zenMode,
    hiddenForSelection,
    typeToSearchEnabled,
    isDesktopSearchOpen,
    onSearchChange,
    isMobile,
  ]);

  React.useEffect(() => {
    if (!searchDrawerOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setSearchDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [searchDrawerOpen]);

  const closeDesktopSearch = () => {
    onSearchChange('');
  };

  const tryCommitTagFromQuery = () => {
    const trimmed = searchQuery.trim();
    if (trimmed.startsWith('#') && trimmed.length > 1) {
      onCommitTagFilter(trimmed.slice(1));
      return true;
    }
    return false;
  };

  const openMobileSearch = () => setSearchDrawerOpen(true);
  const closeMobileSearch = () => setSearchDrawerOpen(false);

  if (zenMode) {
    return (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          onClick={onToggleZenMode}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 backdrop-blur-md text-xs font-medium tracking-wide shadow-xl hover:scale-105 transition-all duration-300"
        >
          <Sparkles className="w-3.5 h-3.5 text-accent-hover" />
          <span>Quitter le mode Zen</span>
        </motion.button>
      </div>
    );
  }

  const renderTagChips = (keyPrefix = 'tag') =>
    activeTagFilters.length > 0 ? (
      <motion.div
        key={`${keyPrefix}-chips`}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 6 }}
        className="flex flex-wrap items-center justify-center gap-1.5 max-w-full px-1"
      >
        {activeTagFilters.map((tag) => (
          <motion.button
            key={tag}
            type="button"
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            onClick={() => onRemoveTagFilter(tag)}
            className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full text-[11px] font-medium bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-md hover:opacity-90 transition-opacity"
            title={`Retirer le filtre #${tag}`}
          >
            <span>#{tag}</span>
            <span className="p-0.5 rounded-full hover:bg-white/20 dark:hover:bg-black/10">
              <X className="w-3 h-3" />
            </span>
          </motion.button>
        ))}
      </motion.div>
    ) : null;

  return (
    <>
      {/* Mobile search drawer */}
      <AnimatePresence>
        {isMobile && searchDrawerOpen && (
          <>
            <motion.button
              type="button"
              aria-label="Fermer la recherche"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[48] bg-black/25 dark:bg-black/45"
              onClick={closeMobileSearch}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-x-0 bottom-0 z-[49] px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3"
            >
              <div className="glass-panel rounded-[1.75rem] border border-black/5 dark:border-white/10 shadow-2xl shadow-black/20 p-4 space-y-3">
                <div className="mx-auto h-1 w-10 rounded-full bg-zinc-300/80 dark:bg-zinc-600/80" />

                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                  <input
                    ref={mobileSearchInputRef}
                    type="search"
                    enterKeyHint="search"
                    placeholder="Rechercher… ou #tag"
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (tryCommitTagFromQuery()) {
                          e.preventDefault();
                        }
                      } else if (
                        e.key === 'Backspace' &&
                        !searchQuery &&
                        activeTagFilters.length > 0
                      ) {
                        onRemoveTagFilter(activeTagFilters[activeTagFilters.length - 1]);
                        e.preventDefault();
                      }
                    }}
                    className="w-full pl-12 pr-12 py-3.5 text-base bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/15 dark:focus:ring-white/20 placeholder:text-zinc-400"
                  />
                  {searchQuery ? (
                    <button
                      type="button"
                      onClick={() => onSearchChange('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                      aria-label="Effacer la recherche"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={closeMobileSearch}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                      aria-label="Fermer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <AnimatePresence>{renderTagChips('drawer')}</AnimatePresence>

                <p className="text-center text-[11px] text-zinc-400 dark:text-zinc-500 px-2">
                  Tapez un mot-clé, ou #tag puis Entrée pour filtrer
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <motion.div
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-[92vw] sm:max-w-none flex flex-col items-center gap-2"
        animate={{
          y: hiddenForSelection || searchDrawerOpen ? 140 : 0,
          opacity: hiddenForSelection || searchDrawerOpen ? 0 : 1,
        }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        style={{
          pointerEvents: hiddenForSelection || searchDrawerOpen ? 'none' : 'auto',
        }}
      >
        <AnimatePresence>
          {(!isMobile || !searchDrawerOpen) && renderTagChips('nav')}
        </AnimatePresence>

        <motion.nav
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="relative glass-panel rounded-full p-2 flex items-center gap-1.5 sm:gap-2 shadow-2xl shadow-black/10 dark:shadow-black/60 border border-black/5 dark:border-white/10"
        >
          {/* Desktop inline search */}
          {!isMobile && (
            <AnimatePresence>
              {isDesktopSearchOpen ? (
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 220, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  className="relative flex items-center overflow-hidden"
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                >
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Rechercher… ou #tag"
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (tryCommitTagFromQuery()) {
                          e.preventDefault();
                        }
                      } else if (
                        e.key === 'Backspace' &&
                        !searchQuery &&
                        activeTagFilters.length > 0
                      ) {
                        onRemoveTagFilter(activeTagFilters[activeTagFilters.length - 1]);
                        e.preventDefault();
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        closeDesktopSearch();
                      }
                    }}
                    className="w-full pl-8 pr-7 py-1.5 text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-full focus:outline-none"
                  />
                  <Search className="w-3.5 h-3.5 absolute left-2.5 text-zinc-400" />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => onSearchChange('')}
                      className="absolute right-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-0.5 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </motion.div>
              ) : null}
            </AnimatePresence>
          )}

          <button
            type="button"
            onClick={() => {
              if (isMobile) {
                openMobileSearch();
                return;
              }
              if (isDesktopSearchOpen) closeDesktopSearch();
            }}
            className={`rounded-full transition-all duration-200 ${
              isMobile ? 'p-3' : 'p-2.5'
            } ${
              isDesktopSearchOpen || (isMobile && (searchQuery.length > 0 || activeTagFilters.length > 0))
                ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
            }`}
            title="Rechercher"
            aria-label="Rechercher"
          >
            <Search className={`stroke-[1.75] ${isMobile ? 'w-6 h-6' : 'w-4 h-4'}`} />
          </button>

          <button
            type="button"
            onClick={onOpenUpload}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-medium text-xs shadow-md hover:scale-105 active:scale-95 transition-all duration-200"
            title="Ajouter une image (ou glisser-déposer sur la page)"
          >
            <Plus className="w-4 h-4 stroke-[2.2]" />
            <span className="hidden sm:inline">Ajouter</span>
          </button>

          <div className="w-[1px] h-5 bg-zinc-200 dark:bg-zinc-800 mx-0.5" />

          <button
            type="button"
            onClick={onToggleZenMode}
            className="p-2.5 rounded-full text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-all duration-200"
            title="Mode Zen (Masquer l'interface)"
          >
            <Eye className="w-4 h-4 stroke-[1.75]" />
          </button>

          <div className="hidden md:flex items-center px-2.5 py-1 text-[11px] font-medium text-zinc-400 dark:text-zinc-500 border-l border-zinc-200 dark:border-zinc-800 ml-0.5">
            <span>{totalImagesCount}</span>
          </div>
        </motion.nav>
      </motion.div>
    </>
  );
};
