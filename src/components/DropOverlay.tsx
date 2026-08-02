import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, Image as ImageIcon, Sparkles } from 'lucide-react';

interface DropOverlayProps {
  isDragging: boolean;
}

export const DropOverlay: React.FC<DropOverlayProps> = ({ isDragging }) => {
  return (
    <AnimatePresence>
      {isDragging && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40 dark:bg-black/70 backdrop-blur-md pointer-events-none"
        >
          <div className="relative max-w-lg w-full p-10 rounded-3xl bg-white/90 dark:bg-zinc-900/90 border border-black/10 dark:border-white/10 shadow-2xl flex flex-col items-center text-center space-y-4">
            <div className="relative">
              <motion.div
                animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                className="w-20 h-20 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-zinc-100 shadow-inner"
              >
                <Upload className="w-9 h-9 stroke-[1.5]" />
              </motion.div>
              <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-accent text-accent-fg flex items-center justify-center shadow-md">
                <Sparkles className="w-4 h-4 fill-current" />
              </div>
            </div>

            <div>
              <h3 className="text-xl font-medium tracking-tight text-zinc-900 dark:text-zinc-100">
                Déposez vos images ici
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                Formats acceptés : PNG, JPG, WEBP, GIF, SVG
              </p>
            </div>

            <div className="pt-2 flex items-center gap-2 text-xs font-medium text-zinc-400 dark:text-zinc-500">
              <ImageIcon className="w-4 h-4" />
              <span>Elles seront automatiquement ajoutées à votre galerie zen</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
