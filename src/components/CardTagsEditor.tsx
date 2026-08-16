import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Tag as TagIcon, X } from 'lucide-react';

interface CardTagsEditorProps {
  tags: string[];
  /** Recent / suggested tags (already on other cards). */
  suggestedTags?: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
}

export const CardTagsEditor: React.FC<CardTagsEditorProps> = ({
  tags,
  suggestedTags = [],
  onAdd,
  onRemove,
}) => {
  const [showAddTag, setShowAddTag] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!showAddTag) return;
    const id = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [showAddTag]);

  const existingLower = useMemo(
    () => new Set(tags.map((t) => t.toLowerCase())),
    [tags]
  );

  const filteredSuggestions = useMemo(() => {
    const q = newTagInput.replace(/^#/, '').trim().toLowerCase();
    return suggestedTags
      .filter((t) => !existingLower.has(t.toLowerCase()))
      .filter((t) => !q || t.toLowerCase().includes(q))
      .slice(0, 8);
  }, [suggestedTags, existingLower, newTagInput]);

  const addTag = (raw: string) => {
    const trimmed = raw.replace(/^#/, '').trim();
    if (!trimmed) return;
    if (existingLower.has(trimmed.toLowerCase())) {
      setNewTagInput('');
      return;
    }
    onAdd(trimmed);
    setNewTagInput('');
    setShowAddTag(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addTag(newTagInput);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-medium text-zinc-500 dark:text-zinc-400">
        <span className="flex items-center gap-1">
          <TagIcon className="w-3.5 h-3.5" /> Étiquettes
        </span>
        <button
          type="button"
          onClick={() => {
            setShowAddTag((v) => !v);
            if (showAddTag) setNewTagInput('');
          }}
          className="text-xs text-zinc-900 dark:text-zinc-100 font-medium hover:underline"
        >
          + Ajouter
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {tags.length > 0 ? (
          tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-200/70 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
            >
              #{tag}
              <button
                type="button"
                onClick={() => onRemove(tag)}
                className="hover:text-rose-500 ml-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))
        ) : (
          <span className="text-xs text-zinc-400 italic">Aucune étiquette</span>
        )}
      </div>

      {showAddTag && (
        <div className="mt-2 space-y-2">
          <form onSubmit={handleSubmit} className="flex gap-1.5">
            <input
              ref={inputRef}
              type="text"
              placeholder="Nouvelle étiquette..."
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400/40"
            />
            <button
              type="submit"
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
            >
              Ajouter
            </button>
          </form>

          {filteredSuggestions.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Récents
              </p>
              <div className="flex flex-wrap gap-1.5">
                {filteredSuggestions.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => addTag(tag)}
                    className="px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-300 border border-zinc-200/80 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
