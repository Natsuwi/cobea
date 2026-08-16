import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Heart,
  Trash2,
  Check,
  Maximize2,
  Minimize2,
  StickyNote,
} from 'lucide-react';
import { ImageItem } from '../types';
import { NoteEditor } from './NoteEditor';
import { DetailDrawingLayer } from './drawing/DetailDrawingLayer';
import { CardTagsEditor } from './CardTagsEditor';
import { useIsMobileViewport } from '../hooks/useIsMobileViewport';

interface NoteModalProps {
  note: ImageItem | null;
  onClose: () => void;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onAddTag: (id: string, tag: string) => void;
  onRemoveTag: (id: string, tag: string) => void;
  onUpdateNote: (
    id: string,
    data: { title?: string; markdown?: string; additionalNotes?: string }
  ) => void;
  onUpdateDrawing: (id: string, data: string | null) => void;
  suggestedTags?: string[];
}

export const NoteModal: React.FC<NoteModalProps> = ({
  note,
  onClose,
  onToggleFavorite,
  onDelete,
  onAddTag,
  onRemoveTag,
  onUpdateNote,
  onUpdateDrawing,
  suggestedTags = [],
}) => {
  const isMobile = useIsMobileViewport();
  const [title, setTitle] = useState('');
  const [markdown, setMarkdown] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [saved, setSaved] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const skipSaveRef = useRef(true);

  useEffect(() => {
    if (note) {
      setTitle(note.title || '');
      setMarkdown(note.markdown || '');
      setAdditionalNotes(note.additionalNotes || '');
      setSaved(false);
      setIsFullscreen(false);
      skipSaveRef.current = true;
    }
  }, [note?.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!note) return;
      if (e.key === 'Escape') {
        if (isFullscreen) {
          setIsFullscreen(false);
          return;
        }
        onClose();
      }
      if ((e.key === 'f' || e.key === 'F') && !e.metaKey && !e.ctrlKey) {
        const tag = (e.target as HTMLElement)?.tagName;
        const editable = (e.target as HTMLElement)?.isContentEditable;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || editable) return;
        setIsFullscreen((v) => !v);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [note, onClose, isFullscreen]);

  useEffect(() => {
    if (!note || isFullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [note, isFullscreen]);

  useEffect(() => {
    if (!isFullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isFullscreen]);

  useEffect(() => {
    if (!note) return;
    if (skipSaveRef.current) {
      skipSaveRef.current = false;
      return;
    }
    if (
      title === (note.title || '') &&
      markdown === (note.markdown || '') &&
      additionalNotes === (note.additionalNotes || '')
    ) {
      return;
    }

    const timer = setTimeout(() => {
      onUpdateNote(note.id, {
        title: title.trim() || 'Note',
        markdown,
        additionalNotes,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }, 400);

    return () => clearTimeout(timer);
  }, [title, markdown, additionalNotes, note, onUpdateNote]);

  if (!note) return null;

  const handleClose = () => {
    setIsFullscreen(false);
    onClose();
  };

  const sidebar = (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Nom
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre de la note"
            className="mt-1.5 w-full text-xl font-medium tracking-tight bg-transparent border-none outline-none text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-300 dark:placeholder:text-zinc-600"
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
            Créée le{' '}
            {new Date(note.createdAt).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
            {saved && (
              <span className="ml-2 inline-flex items-center gap-1 text-emerald-500">
                <Check className="w-3 h-3" /> Enregistré
              </span>
            )}
          </p>
        </div>

        <CardTagsEditor
          tags={note.tags || []}
          suggestedTags={suggestedTags}
          onAdd={(tag) => onAddTag(note.id, tag)}
          onRemove={(tag) => onRemoveTag(note.id, tag)}
        />

        <div className="space-y-2">
          <label className="flex items-center gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            <StickyNote className="w-3.5 h-3.5" />
            Notes supplémentaires
          </label>
          <textarea
            value={additionalNotes}
            onChange={(e) => setAdditionalNotes(e.target.value)}
            placeholder="Contexte, rappels, liens utiles…"
            rows={5}
            className="w-full px-3 py-2.5 text-xs leading-relaxed rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400/40 resize-y min-h-[100px]"
          />
        </div>
      </div>

      <div className="space-y-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
        <button
          type="button"
          onClick={(e) => onToggleFavorite(note.id, e)}
          className={`w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-medium transition-all ${
            note.isFavorite
              ? 'bg-rose-500 text-white'
              : 'bg-zinc-200/70 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-700'
          }`}
        >
          <Heart className={`w-4 h-4 ${note.isFavorite ? 'fill-current' : ''}`} />
          <span>{note.isFavorite ? 'Favori' : 'Ajouter aux favoris'}</span>
        </button>

        <div className="flex gap-2">
          {!isMobile && (
            <button
              type="button"
              onClick={() => setIsFullscreen(true)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-medium bg-zinc-200/70 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-all"
            >
              <Maximize2 className="w-4 h-4" />
              <span>Plein écran</span>
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              onDelete(note.id, e);
            }}
            className={`${isMobile ? 'flex-1 flex items-center justify-center gap-2' : ''} p-2.5 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all text-xs font-medium`}
            title="Supprimer"
          >
            <Trash2 className="w-4 h-4" />
            {isMobile ? <span>Supprimer</span> : null}
          </button>
        </div>
      </div>
    </div>
  );

  if (isFullscreen) {
    return (
      <AnimatePresence>
        <div className="fixed inset-0 z-50 bg-[var(--bg-main)]">
          <motion.div
            key="note-fullscreen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 h-full w-full flex flex-col"
          >
            <div className="pointer-events-none absolute top-0 inset-x-0 z-20 flex items-start justify-end px-4 md:px-6 py-4">
              <div className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-[var(--bg-main)]/80 backdrop-blur-md border border-black/5 dark:border-white/10 p-1 shadow-sm opacity-40 hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200">
                {saved && (
                  <span className="hidden sm:inline-flex items-center gap-1 px-2 text-[11px] text-emerald-500">
                    <Check className="w-3 h-3" /> Enregistré
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setIsFullscreen(false)}
                  className="p-2 rounded-full text-zinc-600 dark:text-zinc-300 hover:bg-zinc-900/5 dark:hover:bg-white/10 transition-colors"
                  title="Quitter le plein écran (Échap)"
                >
                  <Minimize2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="mx-auto w-full max-w-3xl px-6 md:px-10 py-16 md:py-24 flex flex-col min-h-full">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Titre de la note"
                  className="w-full text-3xl md:text-4xl font-medium tracking-tight bg-transparent border-none outline-none text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-300 dark:placeholder:text-zinc-600 mb-8"
                />
                <NoteEditor
                  value={markdown}
                  onChange={setMarkdown}
                  autoFocus
                  minRows={16}
                  variant="fullscreen"
                />
              </div>
            </div>
          </motion.div>
        </div>
      </AnimatePresence>
    );
  }

  if (isMobile) {
    return (
      <AnimatePresence>
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <motion.button
            type="button"
            aria-label="Fermer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
            onClick={handleClose}
          />

          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 flex flex-col w-full h-[94dvh] max-h-[94dvh] rounded-t-[1.75rem] bg-white dark:bg-zinc-900 shadow-2xl border border-black/10 dark:border-white/10 overflow-hidden"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            <div className="shrink-0 flex items-center justify-between px-4 pt-3 pb-2">
              <div className="w-10" />
              <div className="h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-600" />
              <button
                type="button"
                onClick={handleClose}
                className="p-2 rounded-full text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                aria-label="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
              {/* Explicit height — absolute drawing layer needs a real box, not min-height alone */}
              <div
                className="relative w-full shrink-0 bg-zinc-50 dark:bg-zinc-950/40"
                style={{ height: 'min(52vh, 380px)' }}
              >
                <DetailDrawingLayer
                  itemId={note.id}
                  drawingData={note.drawingData}
                  onDrawingChange={onUpdateDrawing}
                  className="absolute inset-0 w-full h-full overflow-hidden"
                >
                  <div className="absolute inset-0 overflow-y-auto overscroll-contain p-4">
                    <NoteEditor
                      value={markdown}
                      onChange={setMarkdown}
                      autoFocus
                      minRows={10}
                      variant="embedded"
                    />
                  </div>
                </DetailDrawingLayer>
              </div>

              <div className="p-5 bg-zinc-50 dark:bg-zinc-900/95">{sidebar}</div>
            </div>
          </motion.div>
        </div>
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/80 backdrop-blur-xl">
        <div className="absolute inset-0" onClick={handleClose} />

        <motion.div
          key="note-modal"
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 w-[min(96vw,1400px)] h-[min(94vh,960px)] bg-white dark:bg-zinc-900 rounded-3xl overflow-hidden shadow-2xl border border-black/10 dark:border-white/10 flex flex-col md:flex-row"
        >
          <DetailDrawingLayer
            itemId={note.id}
            drawingData={note.drawingData}
            onDrawingChange={onUpdateDrawing}
            className="flex-1 relative min-h-[40vh] md:min-h-0 overflow-hidden bg-zinc-50 dark:bg-zinc-950/40"
          >
            <div className="absolute inset-0 overflow-y-auto p-4 md:p-8">
              <NoteEditor
                value={markdown}
                onChange={setMarkdown}
                autoFocus
                minRows={14}
                variant="embedded"
              />
            </div>
          </DetailDrawingLayer>

          <div className="w-full md:w-96 md:max-w-[28%] shrink-0 p-6 md:p-8 flex flex-col justify-between overflow-y-auto bg-zinc-50 dark:bg-zinc-900/90 border-t md:border-t-0 md:border-l border-black/5 dark:border-white/10">
            {sidebar}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
