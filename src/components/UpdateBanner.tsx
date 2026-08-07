import React from 'react';
import { motion } from 'motion/react';
import { RefreshCw, X } from 'lucide-react';

interface UpdateBannerProps {
  builtAt?: string | null;
  updating: boolean;
  onUpdate: () => void;
  onDismiss: () => void;
}

export const UpdateBanner: React.FC<UpdateBannerProps> = ({
  builtAt,
  updating,
  onUpdate,
  onDismiss,
}) => {
  const when = builtAt
    ? new Date(builtAt).toLocaleString(undefined, {
        dateStyle: 'short',
        timeStyle: 'short',
      })
    : null;

  return (
    <motion.div
      initial={{ y: -48, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -48, opacity: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="fixed top-0 inset-x-0 z-[100] flex justify-center px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pointer-events-none"
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-auto w-full max-w-xl rounded-2xl border border-black/8 dark:border-white/12 bg-zinc-950 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-950 shadow-xl shadow-black/20 px-4 py-3 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug">Nouvelle version disponible</p>
          <p className="text-xs opacity-70 mt-0.5 truncate">
            Mets à jour pour forcer le rechargement (cache, cookies).
            {when ? ` Build : ${when}` : ''}
          </p>
        </div>

        <button
          type="button"
          disabled={updating}
          onClick={onUpdate}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-accent hover:bg-accent-hover text-accent-fg text-sm font-semibold px-3 py-2 disabled:opacity-60 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${updating ? 'animate-spin' : ''}`} />
          {updating ? 'Mise à jour…' : 'Mettre à jour'}
        </button>

        <button
          type="button"
          disabled={updating}
          onClick={onDismiss}
          className="shrink-0 p-2 rounded-full opacity-60 hover:opacity-100 hover:bg-white/10 dark:hover:bg-black/10 transition-colors"
          title="Plus tard"
          aria-label="Fermer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
};
