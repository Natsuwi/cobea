import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Link, Upload, Image as ImageIcon, Sparkles, FileText } from 'lucide-react';
import { NoteEditor } from './NoteEditor';

interface AddImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddFromUrl: (url: string, title?: string, tags?: string[]) => void;
  onAddFiles: (files: FileList | File[]) => void;
  onAddNote: (markdown: string, title?: string, tags?: string[]) => void;
}

export const AddImageModal: React.FC<AddImageModalProps> = ({
  isOpen,
  onClose,
  onAddFromUrl,
  onAddFiles,
  onAddNote,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'url' | 'note'>('upload');
  const [urlInput, setUrlInput] = useState('');
  const [titleInput, setTitleInput] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [noteMarkdown, setNoteMarkdown] = useState('');
  const [noteTitle, setNoteTitle] = useState('');

  if (!isOpen) return null;

  const resetAndClose = () => {
    setUrlInput('');
    setTitleInput('');
    setTagInput('');
    setNoteMarkdown('');
    setNoteTitle('');
    onClose();
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;

    const tags = tagInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    onAddFromUrl(urlInput.trim(), titleInput.trim() || 'Image Web', tags);
    resetAndClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onAddFiles(e.target.files);
      resetAndClose();
    }
  };

  const handleNoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteMarkdown.trim()) return;

    const tags = tagInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const firstLine = noteMarkdown.trim().split('\n')[0].replace(/^#+\s*/, '').slice(0, 60);
    onAddNote(
      noteMarkdown.trim(),
      noteTitle.trim() || firstLine || 'Note',
      tags.length > 0 ? tags : ['Note']
    );
    resetAndClose();
  };

  const tabClass = (tab: typeof activeTab) =>
    `flex-1 py-1.5 text-xs font-medium rounded-full transition-all flex items-center justify-center gap-1.5 ${
      activeTab === tab
        ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm'
        : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
    }`;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto">
        <div className="absolute inset-0" onClick={resetAndClose} />

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className={`relative z-10 w-full bg-white dark:bg-zinc-900 rounded-3xl p-6 md:p-8 shadow-2xl border border-black/10 dark:border-white/10 space-y-6 my-4 ${
            activeTab === 'note' ? 'max-w-2xl' : 'max-w-md'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent" />
              <span>
                {activeTab === 'note' ? 'Ajouter une note' : 'Ajouter une image'}
              </span>
            </h3>
            <button
              type="button"
              onClick={resetAndClose}
              className="p-2 rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex rounded-full bg-zinc-100 dark:bg-zinc-800 p-1 gap-0.5">
            <button type="button" onClick={() => setActiveTab('upload')} className={tabClass('upload')}>
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Fichier</span>
            </button>
            <button type="button" onClick={() => setActiveTab('url')} className={tabClass('url')}>
              <Link className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">URL</span>
            </button>
            <button type="button" onClick={() => setActiveTab('note')} className={tabClass('note')}>
              <FileText className="w-3.5 h-3.5" />
              <span>Note</span>
            </button>
          </div>

          {activeTab === 'upload' && (
            <div className="space-y-4">
              <label className="border-2 border-dashed border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-zinc-50/50 dark:bg-zinc-800/30 group">
                <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300 mb-3 group-hover:scale-110 transition-transform">
                  <ImageIcon className="w-6 h-6 stroke-[1.5]" />
                </div>
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Cliquez pour parcourir
                </span>
                <span className="text-xs text-zinc-400 mt-1">
                  ou glissez-déposez n'importe où sur l'écran
                </span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {activeTab === 'url' && (
            <form onSubmit={handleUrlSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  URL de l'image *
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://images.unsplash.com/..."
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="w-full px-4 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Titre (optionnel)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Paysage Minimaliste"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  className="w-full px-4 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Étiquettes (séparées par une virgule)
                </label>
                <input
                  type="text"
                  placeholder="Design, Nature, Minimal"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  className="w-full px-4 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-medium text-xs hover:opacity-90 transition-opacity"
              >
                Ajouter l'image
              </button>
            </form>
          )}

          {activeTab === 'note' && (
            <form onSubmit={handleNoteSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Titre (optionnel)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Idées, citation, liste…"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  className="w-full px-4 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none"
                />
              </div>

              <NoteEditor
                value={noteMarkdown}
                onChange={setNoteMarkdown}
                autoFocus
                minRows={6}
              />

              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Étiquettes (séparées par une virgule)
                </label>
                <input
                  type="text"
                  placeholder="Idées, Perso, Travail"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  className="w-full px-4 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={!noteMarkdown.trim()}
                className="w-full py-2.5 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-medium text-xs hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Ajouter la note
              </button>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
