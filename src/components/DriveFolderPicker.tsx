import React, { useCallback, useEffect, useState } from 'react';
import { Check, ChevronRight, Folder, Loader2, X } from 'lucide-react';
import { api, type DriveFolderRef } from '../lib/api';

type Mode = 'upload' | 'sync';

interface DriveFolderPickerProps {
  mode: Mode;
  /** Pre-selected folder ids (sync multi / upload single) */
  selected: DriveFolderRef[];
  onConfirm: (folders: DriveFolderRef[]) => void;
  onClose: () => void;
}

export const DriveFolderPicker: React.FC<DriveFolderPickerProps> = ({
  mode,
  selected,
  onConfirm,
  onClose,
}) => {
  const [breadcrumbs, setBreadcrumbs] = useState<DriveFolderRef[]>([
    { id: 'root', name: 'Mon Drive' },
  ]);
  const [folders, setFolders] = useState<DriveFolderRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Map<string, DriveFolderRef>>(() => {
    const m = new Map<string, DriveFolderRef>();
    for (const f of selected) m.set(f.id, f);
    return m;
  });

  const load = useCallback(async (pid: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listDriveFolders(pid);
      setFolders(res.folders);
      setBreadcrumbs(res.breadcrumbs.length ? res.breadcrumbs : [{ id: 'root', name: 'Mon Drive' }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de lister les dossiers');
      setFolders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(null);
  }, [load]);

  const togglePick = (folder: DriveFolderRef) => {
    setPicked((prev) => {
      const next = new Map(prev);
      if (mode === 'upload') {
        next.clear();
        next.set(folder.id, folder);
        return next;
      }
      if (next.has(folder.id)) next.delete(folder.id);
      else next.set(folder.id, folder);
      return next;
    });
  };

  const enter = (folder: DriveFolderRef) => {
    void load(folder.id);
  };

  const goBreadcrumb = (crumb: DriveFolderRef) => {
    void load(crumb.id === 'root' ? null : crumb.id);
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'upload' ? 'Choisir le dossier d’upload' : 'Choisir les dossiers à synchroniser'}
    >
      <div className="w-full sm:max-w-md max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-white/10 shrink-0">
          <div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              {mode === 'upload' ? 'Dossier d’upload' : 'Dossiers à synchroniser'}
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">
              {mode === 'upload'
                ? 'Les nouvelles cards iront dans ce dossier Drive.'
                : 'Coche un dossier : sous-dossiers + fichiers inclus ; chaque dossier du chemin devient un tag.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/10"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-3 py-2 flex items-center gap-1 overflow-x-auto no-scrollbar border-b border-zinc-100 dark:border-white/10 shrink-0 text-xs">
          {breadcrumbs.map((crumb, i) => (
            <React.Fragment key={crumb.id}>
              {i > 0 && <ChevronRight className="w-3 h-3 text-zinc-400 shrink-0" />}
              <button
                type="button"
                onClick={() => goBreadcrumb(crumb)}
                className={`shrink-0 px-1.5 py-0.5 rounded hover:bg-zinc-100 dark:hover:bg-white/10 ${
                  i === breadcrumbs.length - 1
                    ? 'font-medium text-zinc-900 dark:text-zinc-100'
                    : 'text-zinc-500'
                }`}
              >
                {crumb.name}
              </button>
            </React.Fragment>
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-zinc-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Chargement…
            </div>
          )}
          {!loading && error && (
            <p className="text-sm text-rose-600 dark:text-rose-400 px-4 py-8 text-center">{error}</p>
          )}
          {!loading && !error && folders.length === 0 && (
            <p className="text-sm text-zinc-500 px-4 py-8 text-center">Aucun sous-dossier ici.</p>
          )}
          {!loading &&
            !error &&
            folders.map((folder) => {
              const isSelected = picked.has(folder.id);
              return (
                <div
                  key={folder.id}
                  className="flex items-center gap-2 px-3 py-2.5 border-b border-zinc-50 dark:border-white/5 hover:bg-zinc-50 dark:hover:bg-white/5"
                >
                  <button
                    type="button"
                    onClick={() => togglePick(folder)}
                    className={`shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                      isSelected
                        ? 'bg-accent border-accent text-accent-fg'
                        : 'border-zinc-300 dark:border-zinc-600'
                    }`}
                    aria-pressed={isSelected}
                    aria-label={isSelected ? 'Désélectionner' : 'Sélectionner'}
                  >
                    {isSelected && <Check className="w-3 h-3" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => enter(folder)}
                    className="flex-1 flex items-center gap-2 min-w-0 text-left"
                  >
                    <Folder className="w-4 h-4 text-accent shrink-0" />
                    <span className="text-sm text-zinc-800 dark:text-zinc-100 truncate">
                      {folder.name}
                    </span>
                    <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0 ml-auto" />
                  </button>
                </div>
              );
            })}
        </div>

        <div className="px-4 py-3 border-t border-zinc-100 dark:border-white/10 flex items-center gap-2 shrink-0">
          <p className="text-xs text-zinc-500 flex-1 truncate">
            {picked.size === 0
              ? 'Aucune sélection'
              : mode === 'upload'
                ? [...picked.values()][0]?.name
                : `${picked.size} dossier${picked.size > 1 ? 's' : ''}`}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 rounded-xl text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={mode === 'upload' ? picked.size === 0 : false}
            onClick={() => onConfirm([...picked.values()])}
            className="px-3 py-2 rounded-xl text-sm font-medium bg-accent text-accent-fg disabled:opacity-40"
          >
            Confirmer
          </button>
        </div>
      </div>
    </div>
  );
};
