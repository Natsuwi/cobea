import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive actions use rose styling */
  tone?: 'danger' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
};

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  description,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  tone = 'danger',
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const confirmClass =
    tone === 'danger'
      ? 'bg-rose-500 text-white hover:bg-rose-600 shadow-lg shadow-rose-500/20'
      : 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 hover:opacity-90';

  return (
    <AnimatePresence>
      {open ? (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          aria-describedby={description ? 'confirm-dialog-desc' : undefined}
        >
          <motion.button
            type="button"
            aria-label="Fermer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
            onClick={onCancel}
          />

          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full sm:max-w-md rounded-t-[1.75rem] sm:rounded-3xl bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/10 shadow-2xl overflow-hidden"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            <div className="flex items-start gap-3 px-5 pt-5 pb-2 sm:px-6 sm:pt-6">
              <div
                className={`shrink-0 mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl ${
                  tone === 'danger'
                    ? 'bg-rose-500/10 text-rose-500'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'
                }`}
              >
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <h2
                  id="confirm-dialog-title"
                  className="text-base font-medium tracking-tight text-zinc-900 dark:text-zinc-100"
                >
                  {title}
                </h2>
                {description ? (
                  <p
                    id="confirm-dialog-desc"
                    className="mt-1.5 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400 font-light"
                  >
                    {description}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onCancel}
                className="shrink-0 p-2 -mr-1 -mt-1 rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2 px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 py-2.5 px-4 rounded-xl text-sm font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-colors ${confirmClass}`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
};
