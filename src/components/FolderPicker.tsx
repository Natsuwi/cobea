import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Check } from 'lucide-react';
import { Folder } from '../types';
import { FolderIcon, FOLDER_ICON_OPTIONS } from '../lib/folderIcons';

interface FolderPickerProps {
  isOpen: boolean;
  onClose: () => void;
  folders: Folder[];
  dropTargetFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onCreateFolder: (name: string, icon: string) => void;
  itemCounts: Record<string, number>;
  /** When true, selecting a folder assigns items instead of toggling drop target */
  assignMode?: boolean;
  onAssignFolder?: (folderId: string) => void;
}

export const FolderPicker: React.FC<FolderPickerProps> = ({
  isOpen,
  onClose,
  folders,
  dropTargetFolderId,
  onSelectFolder,
  onCreateFolder,
  itemCounts,
  assignMode = false,
  onAssignFolder,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('folder');
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setIsCreating(false);
      setNewName('');
      setNewIcon('folder');
      return;
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isCreating && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCreating]);

  const handleSubmitCreate = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    onCreateFolder(trimmed, newIcon);
    setIsCreating(false);
    setNewName('');
    setNewIcon('folder');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={panelRef}
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.96 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="absolute bottom-[calc(100%+12px)] left-1/2 -translate-x-1/2 w-[280px] max-h-[360px] overflow-y-auto no-scrollbar rounded-2xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-black/8 dark:border-white/10 shadow-2xl shadow-black/15 dark:shadow-black/50 p-2 z-[80]"
        >
          <p className="px-2.5 pt-1.5 pb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            {assignMode ? 'Choisir un dossier' : 'Dossiers'}
          </p>

          <div className="flex flex-col gap-1">
            {folders.map((folder) => {
              const isSelected = dropTargetFolderId === folder.id;
              const count = itemCounts[folder.id] || 0;
              return (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => {
                    if (assignMode && onAssignFolder) {
                      onAssignFolder(folder.id);
                      onClose();
                      return;
                    }
                    onSelectFolder(isSelected ? null : folder.id);
                    onClose();
                  }}
                  className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-left transition-all duration-150 ${
                    isSelected
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950'
                      : 'hover:bg-zinc-100 dark:hover:bg-zinc-800/80 text-zinc-800 dark:text-zinc-200'
                  }`}
                >
                  <span
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isSelected
                        ? 'bg-white/15 dark:bg-black/10'
                        : 'bg-zinc-100 dark:bg-zinc-800'
                    }`}
                  >
                    <FolderIcon name={folder.icon} className="w-4 h-4 stroke-[1.75]" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-medium truncate">{folder.name}</span>
                    <span
                      className={`block text-[10px] ${
                        isSelected
                          ? 'text-white/60 dark:text-zinc-950/50'
                          : 'text-zinc-400 dark:text-zinc-500'
                      }`}
                    >
                      {count} élément{count !== 1 ? 's' : ''}
                    </span>
                  </span>
                  {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                </button>
              );
            })}

            {/* Dashed create folder card */}
            {!isCreating ? (
              <button
                type="button"
                onClick={() => setIsCreating(true)}
                className="w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-600 text-zinc-500 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-all duration-150"
              >
                <span className="w-8 h-8 rounded-lg border border-dashed border-current flex items-center justify-center shrink-0">
                  <Plus className="w-4 h-4" />
                </span>
                <span className="text-xs font-medium">Nouveau dossier</span>
              </button>
            ) : (
              <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-600 p-2.5 space-y-2.5 bg-zinc-50/80 dark:bg-zinc-800/40">
                <input
                  ref={inputRef}
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSubmitCreate();
                    if (e.key === 'Escape') setIsCreating(false);
                  }}
                  placeholder="Nom du dossier"
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none"
                />
                <div className="flex flex-wrap gap-1">
                  {FOLDER_ICON_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const active = newIcon === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        title={opt.label}
                        onClick={() => setNewIcon(opt.id)}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                          active
                            ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950'
                            : 'text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 stroke-[1.75]" />
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="flex-1 px-2 py-1.5 text-[11px] rounded-lg text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitCreate}
                    disabled={!newName.trim()}
                    className="flex-1 px-2 py-1.5 text-[11px] font-medium rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 disabled:opacity-40"
                  >
                    Créer
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
