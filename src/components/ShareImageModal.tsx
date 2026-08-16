import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Tag as TagIcon, StickyNote, Share2 } from 'lucide-react';
import { useIsMobileViewport } from '../hooks/useIsMobileViewport';

export type ShareImageDraft = {
  file: File;
  title?: string;
  text?: string;
  url?: string;
};

interface ShareImageModalProps {
  draft: ShareImageDraft | null;
  suggestedTags?: string[];
  defaultTags?: string[];
  onClose: () => void;
  onConfirm: (payload: {
    file: File;
    title: string;
    tags: string[];
    additionalNotes: string;
  }) => void;
}

function parseTagInput(raw: string): string[] {
  return raw
    .split(/[,;\s]+/)
    .map((t) => t.replace(/^#/, '').trim())
    .filter(Boolean);
}

export const ShareImageModal: React.FC<ShareImageModalProps> = ({
  draft,
  suggestedTags = [],
  defaultTags = [],
  onClose,
  onConfirm,
}) => {
  const isMobile = useIsMobileViewport();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  useEffect(() => {
    if (!draft) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(draft.file);
    setPreviewUrl(url);
    const base = draft.file.name.replace(/\.[^/.]+$/, '').trim();
    const generic = !base || /^image|blob|shared$/i.test(base);
    setTitle(draft.title?.trim() || (generic ? '' : base));
    setNote(draft.text?.trim() || '');
    setTagInput('');
    setTags(defaultTags.length > 0 ? [...defaultTags] : []);
    return () => URL.revokeObjectURL(url);
    // Init once per shared file — ignore defaultTags identity churn
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.file]);

  useEffect(() => {
    if (!draft) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [draft]);

  const existingLower = useMemo(
    () => new Set(tags.map((t) => t.toLowerCase())),
    [tags]
  );

  const filteredSuggestions = useMemo(() => {
    const q = tagInput.replace(/^#/, '').trim().toLowerCase();
    return suggestedTags
      .filter((t) => !existingLower.has(t.toLowerCase()))
      .filter((t) => !q || t.toLowerCase().includes(q))
      .slice(0, 8);
  }, [suggestedTags, existingLower, tagInput]);

  if (!draft) return null;

  const addTag = (raw: string) => {
    const next = parseTagInput(raw);
    if (next.length === 0) return;
    setTags((prev) => {
      const seen = new Set(prev.map((t) => t.toLowerCase()));
      const merged = [...prev];
      for (const t of next) {
        if (seen.has(t.toLowerCase())) continue;
        seen.add(t.toLowerCase());
        merged.push(t);
      }
      return merged;
    });
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fromInput = parseTagInput(tagInput);
    const finalTags =
      [...tags, ...fromInput].length > 0
        ? Array.from(
            new Map(
              [...tags, ...fromInput].map((t) => [t.toLowerCase(), t] as const)
            ).values()
          )
        : ['Partage'];
    onConfirm({
      file: draft.file,
      title: title.trim() || 'Image partagée',
      tags: finalTags,
      additionalNotes: note.trim(),
    });
  };

  const form = (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-20 h-20 rounded-2xl overflow-hidden bg-zinc-200 dark:bg-zinc-800 border border-black/5 dark:border-white/10">
          {previewUrl ? (
            <img src={previewUrl} alt="" className="w-full h-full object-cover" />
          ) : null}
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 flex items-center gap-1">
            <Share2 className="w-3.5 h-3.5" />
            Partage vers Cobea
          </p>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre de la card"
            className="w-full text-lg font-medium tracking-tight bg-transparent border-none outline-none text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-300 dark:placeholder:text-zinc-600"
          />
          <p className="text-[11px] text-zinc-500 truncate">
            {draft.file.name || 'Image'}
            {draft.url ? ` · ${draft.url}` : ''}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          <StickyNote className="w-3.5 h-3.5" />
          Note
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Contexte, rappel, source…"
          rows={4}
          className="w-full px-3 py-2.5 text-sm leading-relaxed rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400/40 resize-y min-h-[96px]"
        />
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          <TagIcon className="w-3.5 h-3.5" />
          Étiquettes
        </label>
        <div className="flex flex-wrap gap-1.5 min-h-[1.5rem]">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-200/70 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
            >
              #{tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="hover:text-rose-500 ml-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-1.5">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                addTag(tagInput);
              }
            }}
            placeholder="Ajouter un tag…"
            className="flex-1 px-3 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400/40"
          />
          <button
            type="button"
            onClick={() => addTag(tagInput)}
            className="px-3 py-2 text-xs font-medium rounded-xl bg-zinc-200/80 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200"
          >
            Ajouter
          </button>
        </div>
        {filteredSuggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {filteredSuggestions.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => addTag(tag)}
                className="px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-300 border border-zinc-200/80 dark:border-zinc-700"
              >
                #{tag}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-3 rounded-xl text-sm font-medium bg-zinc-200/70 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200"
        >
          Annuler
        </button>
        <button
          type="submit"
          className="flex-1 py-3 rounded-xl text-sm font-medium bg-zinc-900 text-white dark:bg-white dark:text-zinc-950"
        >
          Créer la card
        </button>
      </div>
    </form>
  );

  return (
    <AnimatePresence>
      {isMobile ? (
        <div className="fixed inset-0 z-[95] flex flex-col justify-end">
          <motion.button
            type="button"
            aria-label="Fermer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-h-[92dvh] rounded-t-[1.75rem] bg-white dark:bg-zinc-900 shadow-2xl border border-black/10 dark:border-white/10 overflow-hidden flex flex-col"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            <div className="shrink-0 flex items-center justify-between px-4 pt-3 pb-2">
              <div className="w-10" />
              <div className="h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-600" />
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-full text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                aria-label="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pb-5">
              {form}
            </div>
          </motion.div>
        </div>
      ) : (
        <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xl">
          <div className="absolute inset-0" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-md rounded-3xl bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/10 shadow-2xl p-6"
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              aria-label="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
            {form}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
