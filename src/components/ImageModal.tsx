import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Heart,
  Trash2,
  Copy,
  Download,
  Check,
  Tag as TagIcon,
} from 'lucide-react';
import { ImageItem } from '../types';
import { DetailDrawingLayer } from './drawing/DetailDrawingLayer';

interface ImageModalProps {
  image: ImageItem | null;
  onClose: () => void;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onAddTag: (id: string, tag: string) => void;
  onRemoveTag: (id: string, tag: string) => void;
  onUpdateDrawing: (id: string, data: string | null) => void;
}

export const ImageModal: React.FC<ImageModalProps> = ({
  image,
  onClose,
  onToggleFavorite,
  onDelete,
  onAddTag,
  onRemoveTag,
  onUpdateDrawing,
}) => {
  const [copied, setCopied] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [showAddTag, setShowAddTag] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!image) return;
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [image, onClose]);

  if (!image) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(image.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = image.url;
    link.download = `${image.title || 'galerie-image'}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAddTagSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTagInput.trim()) {
      onAddTag(image.id, newTagInput.trim());
      setNewTagInput('');
      setShowAddTag(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/80 backdrop-blur-xl">
        <div className="absolute inset-0" onClick={onClose} />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 w-[min(96vw,1400px)] h-[min(94vh,960px)] bg-white dark:bg-zinc-900 rounded-3xl overflow-hidden shadow-2xl border border-black/10 dark:border-white/10 flex flex-col md:flex-row"
        >
          {/* Image Display Area */}
          <DetailDrawingLayer
            itemId={image.id}
            drawingData={image.drawingData}
            onDrawingChange={onUpdateDrawing}
            className="flex-1 bg-zinc-950 min-h-[40vh] md:min-h-0 overflow-hidden"
          >
            <div className="absolute inset-0 flex items-center justify-center p-4 md:p-8">
              <img
                src={image.url}
                alt={image.title}
                draggable={false}
                className="max-h-full max-w-full w-auto h-auto object-contain rounded-xl shadow-2xl pointer-events-none"
              />
            </div>
          </DetailDrawingLayer>

          {/* Image Details Sidebar */}
          <div className="w-full md:w-96 md:max-w-[28%] shrink-0 p-6 md:p-8 flex flex-col justify-between overflow-y-auto bg-zinc-50 dark:bg-zinc-900/90 border-t md:border-t-0 md:border-l border-black/5 dark:border-white/10 space-y-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-medium tracking-tight text-zinc-900 dark:text-zinc-100">
                  {image.title || 'Image sans titre'}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Ajoutée le{' '}
                  {new Date(image.createdAt).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  <span className="flex items-center gap-1">
                    <TagIcon className="w-3.5 h-3.5" /> Étiquettes
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAddTag(!showAddTag)}
                    className="text-xs text-zinc-900 dark:text-zinc-100 font-medium hover:underline"
                  >
                    + Ajouter
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {image.tags && image.tags.length > 0 ? (
                    image.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-200/70 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                      >
                        #{tag}
                        <button
                          type="button"
                          onClick={() => onRemoveTag(image.id, tag)}
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
                  <form onSubmit={handleAddTagSubmit} className="mt-2 flex gap-1.5">
                    <input
                      type="text"
                      placeholder="Nouvelle étiquette..."
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      className="flex-1 px-3 py-1 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1 text-xs font-medium rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                    >
                      Ajouter
                    </button>
                  </form>
                )}
              </div>

              <div className="pt-2">
                <span className="text-[11px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider font-semibold">
                  Source :{' '}
                  {image.source === 'uploaded'
                    ? 'Importation locale'
                    : image.source === 'url'
                      ? 'Lien Web'
                      : 'Galerie Zen'}
                </span>
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={(e) => onToggleFavorite(image.id, e)}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-medium transition-all ${
                    image.isFavorite
                      ? 'bg-rose-500 text-white'
                      : 'bg-zinc-200/70 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-700'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${image.isFavorite ? 'fill-current' : ''}`} />
                  <span>{image.isFavorite ? 'Favori' : 'Ajouter aux favoris'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-medium bg-zinc-200/70 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-all"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Copié !' : 'Copier le lien'}</span>
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-medium bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 hover:opacity-90 transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>Télécharger</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    onDelete(image.id, e);
                    onClose();
                  }}
                  className="p-2.5 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all"
                  title="Supprimer l'image"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
