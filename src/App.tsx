import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { AnimatePresence } from 'motion/react';
import {
  ImageItem,
  ThemeMode,
  Folder,
  MoodboardPlacement,
  UserProfile,
  isNoteItem,
  isImageItem,
  isMoodboardItem,
} from './types';
import { MasonryGrid } from './components/MasonryGrid';
import { BottomNavbar } from './components/BottomNavbar';
import { DropOverlay } from './components/DropOverlay';
import { CardSelectionDock, getDraggedItemId } from './components/CardSelectionDock';
import { ImageModal } from './components/ImageModal';
import { NoteModal } from './components/NoteModal';
import { MoodboardModal } from './components/MoodboardModal';
import { AddImageModal } from './components/AddImageModal';
import { ZenHeader } from './components/ZenHeader';
import { ProfileAvatarButton } from './components/ProfileAvatarButton';
import { AccountPanel } from './components/AccountPanel';
import { AuthScreen } from './components/AuthScreen';
import { UpdateBanner } from './components/UpdateBanner';
import { CobeaLogoMark } from './components/CobeaBrand';
import { ITEM_DRAG_MIME } from './hooks/useCardDragPreview';
import { placementSizeFromAspect, getItemAspectRatio } from './components/MoodboardCardFrame';
import { api, dataUrlToBlob, getToken, setToken, type DriveFolderRef, type StorageState } from './lib/api';
import { useAppUpdate } from './hooks/useAppUpdate';

const THEME_KEY = 'zen_gallery_theme_v1';
const COLUMNS_KEY = 'zen_gallery_columns_v1';

/** Prevents React Strict Mode double-mount from running bootstrap/sync twice. */
let bootstrapStarted = false;

function applyMeStorage(
  me: StorageState,
  setters: {
    setGoogleConnected: (v: boolean) => void;
    setStorageMode: (v: 'standard' | 'google') => void;
    setGoogleConfigured: (v: boolean) => void;
    setGoogleUploadFolderId: (v: string | null) => void;
    setGoogleUploadFolderName: (v: string | null) => void;
    setGoogleSyncFolders: (v: DriveFolderRef[]) => void;
    setGoogleLastSyncAt: (v: string | null) => void;
  }
) {
  setters.setGoogleConnected(me.googleConnected);
  setters.setStorageMode(me.storageMode);
  setters.setGoogleConfigured(me.googleConfigured);
  setters.setGoogleUploadFolderId(me.googleUploadFolderId ?? null);
  setters.setGoogleUploadFolderName(me.googleUploadFolderName ?? null);
  setters.setGoogleSyncFolders(me.googleSyncFolders ?? []);
  setters.setGoogleLastSyncAt(me.googleLastSyncAt ?? null);
}

export default function App() {
  const {
    updateAvailable,
    builtAt,
    updating,
    applyUpdate,
    dismiss: dismissUpdateBanner,
  } = useAppUpdate();

  const [bootstrapping, setBootstrapping] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [storageMode, setStorageMode] = useState<'standard' | 'google'>('standard');
  const [googleConfigured, setGoogleConfigured] = useState(false);
  const [googleUploadFolderId, setGoogleUploadFolderId] = useState<string | null>(null);
  const [googleUploadFolderName, setGoogleUploadFolderName] = useState<string | null>(null);
  const [googleSyncFolders, setGoogleSyncFolders] = useState<DriveFolderRef[]>([]);
  const [googleLastSyncAt, setGoogleLastSyncAt] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem(THEME_KEY);
    return (saved as ThemeMode) || 'light';
  });

  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);

  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [isCardDragging, setIsCardDragging] = useState(false);
  const [isOverSelectionDock, setIsOverSelectionDock] = useState(false);
  const [isNearSelectionDock, setIsNearSelectionDock] = useState(false);
  const [selectionDockIds, setSelectionDockIds] = useState<string[]>([]);
  const [isFavoriteFilterActive, setIsFavoriteFilterActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTagFilters, setActiveTagFilters] = useState<string[]>([]);
  const [zenMode, setZenMode] = useState(false);
  const [columnCount, setColumnCount] = useState<number>(() => {
    const saved = localStorage.getItem(COLUMNS_KEY);
    const n = saved ? Number(saved) : 5;
    return n >= 2 && n <= 6 ? n : 5;
  });

  const handleToggleZenMode = useCallback(async () => {
    if (zenMode) {
      setZenMode(false);
      if (document.fullscreenElement) {
        try {
          await document.exitFullscreen();
        } catch {
          /* ignore */
        }
      }
      return;
    }

    setZenMode(true);
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      /* Browser may deny fullscreen without gesture / policy */
    }
  }, [zenMode]);

  // Leaving browser fullscreen (Esc / F11) also leaves Zen mode
  useEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setZenMode(false);
      }
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const selectedFolderIdRef = useRef(selectedFolderId);
  selectedFolderIdRef.current = selectedFolderId;

  const refreshGallery = useCallback(async () => {
    const [cardsRes, foldersRes] = await Promise.all([api.listCards(), api.listFolders()]);
    setImages(cardsRes.cards);
    setFolders(foldersRes.folders);
  }, []);

  const storageSetters = useMemo(
    () => ({
      setGoogleConnected,
      setStorageMode,
      setGoogleConfigured,
      setGoogleUploadFolderId,
      setGoogleUploadFolderName,
      setGoogleSyncFolders,
      setGoogleLastSyncAt,
    }),
    []
  );

  const applyStoragePartial = useCallback((partial: Partial<StorageState>) => {
    if (partial.googleConnected !== undefined) setGoogleConnected(partial.googleConnected);
    if (partial.storageMode !== undefined) setStorageMode(partial.storageMode);
    if (partial.googleConfigured !== undefined) setGoogleConfigured(partial.googleConfigured);
    if (partial.googleUploadFolderId !== undefined) {
      setGoogleUploadFolderId(partial.googleUploadFolderId);
    }
    if (partial.googleUploadFolderName !== undefined) {
      setGoogleUploadFolderName(partial.googleUploadFolderName);
    }
    if (partial.googleSyncFolders !== undefined) {
      setGoogleSyncFolders(partial.googleSyncFolders);
    }
    if (partial.googleLastSyncAt !== undefined) {
      setGoogleLastSyncAt(partial.googleLastSyncAt);
    }
  }, []);

  const maybeBackgroundSync = useCallback(async () => {
    try {
      const me = await api.me();
      applyMeStorage(me, storageSetters);
      if (
        me.storageMode !== 'google' ||
        !me.googleConnected ||
        (me.googleSyncFolders?.length ?? 0) === 0
      ) {
        return;
      }
      // Don't block / re-scan Drive on every page load — only if idle > 6h
      const last = me.googleLastSyncAt ? Date.parse(me.googleLastSyncAt) : 0;
      if (last && Date.now() - last < 6 * 60 * 60 * 1000) return;

      const result = await api.syncGoogleDrive();
      setGoogleLastSyncAt(result.googleLastSyncAt);
      if (result.imported > 0) await refreshGallery();
    } catch {
      /* ignore background sync errors */
    }
  }, [refreshGallery, storageSetters]);

  const bootstrap = useCallback(async () => {
    setBootstrapping(true);
    setLoadError(null);
    try {
      const token = getToken();
      if (!token) {
        const config = await api.config();
        setGoogleConfigured(config.googleConfigured);
        setAuthed(false);
        return;
      }

      // Parallel: config + session + gallery
      const [config, me, cardsRes, foldersRes] = await Promise.all([
        api.config(),
        api.me(),
        api.listCards(),
        api.listFolders(),
      ]);
      setGoogleConfigured(config.googleConfigured);
      setProfile(me.profile);
      applyMeStorage(me, storageSetters);
      if (me.profile.theme === 'light' || me.profile.theme === 'dark') {
        setTheme(me.profile.theme);
      }
      setImages(cardsRes.cards);
      setFolders(foldersRes.folders);
      setAuthed(true);
      // Show UI immediately; sync Drive in background only if idle > 6h
      void maybeBackgroundSync();
    } catch {
      setToken(null);
      setAuthed(false);
      setProfile(null);
    } finally {
      setBootstrapping(false);
    }
  }, [maybeBackgroundSync, storageSetters]);

  useEffect(() => {
    if (bootstrapStarted) return;
    bootstrapStarted = true;

    const params = new URLSearchParams(window.location.search);
    const google = params.get('google');
    if (google) {
      window.history.replaceState({}, '', window.location.pathname);
      if (google === 'connected') {
        setIsAccountOpen(true);
      }
    }
    void bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isCardDragging) {
      setIsNearSelectionDock(false);
      return;
    }
    const updateProximity = (e: DragEvent) => {
      if (e.clientY === 0 && e.clientX === 0) return;
      setIsNearSelectionDock(e.clientY > window.innerHeight * 0.68);
    };
    window.addEventListener('dragover', updateProximity);
    window.addEventListener('drag', updateProximity);
    return () => {
      window.removeEventListener('dragover', updateProximity);
      window.removeEventListener('drag', updateProximity);
    };
  }, [isCardDragging]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem(THEME_KEY, theme);
    if (authed) {
      void api.updateProfile({ theme }).catch(() => undefined);
    }
  }, [theme, authed]);

  useEffect(() => {
    localStorage.setItem(COLUMNS_KEY, String(columnCount));
  }, [columnCount]);

  useEffect(() => {
    if (!authed) return;

    let dragCounter = 0;
    const isInternalCardDrag = (dt: DataTransfer | null) => {
      if (!dt) return false;
      return Array.from(dt.types).includes(ITEM_DRAG_MIME);
    };
    const isExternalImageDrop = (dt: DataTransfer | null) => {
      if (!dt || isInternalCardDrag(dt)) return false;
      const types = Array.from(dt.types);
      return types.includes('Files') || types.includes('text/uri-list');
    };

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      if (isInternalCardDrag(e.dataTransfer)) return;
      dragCounter++;
      if (isExternalImageDrop(e.dataTransfer)) setIsDragging(true);
    };
    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      if (isInternalCardDrag(e.dataTransfer)) return;
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        setIsDragging(false);
      }
    };
    const handleDragOver = (e: DragEvent) => e.preventDefault();
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounter = 0;
      setIsDragging(false);
      if (isInternalCardDrag(e.dataTransfer)) return;
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        void handleProcessFiles(e.dataTransfer.files);
        return;
      }
      const uri =
        e.dataTransfer?.getData('text/uri-list')?.split('\n').find((l) => l && !l.startsWith('#')) ||
        e.dataTransfer?.getData('text/plain');
      if (uri && (uri.startsWith('http://') || uri.startsWith('https://'))) {
        void handleAddFromUrl(uri, 'Image externe', ['Web']);
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);
    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  const availableTags = useMemo(() => {
    const tagsSet = new Set<string>();
    images.forEach((img) => img.tags?.forEach((t) => tagsSet.add(t)));
    return Array.from(tagsSet);
  }, [images]);

  const commitTagFilter = useCallback(
    (rawTag: string) => {
      const trimmed = rawTag.replace(/^#/, '').trim();
      if (!trimmed) return false;
      const canonical =
        availableTags.find((t) => t.toLowerCase() === trimmed.toLowerCase()) || trimmed;
      setActiveTagFilters((prev) => {
        if (prev.some((t) => t.toLowerCase() === canonical.toLowerCase())) return prev;
        return [...prev, canonical];
      });
      return true;
    },
    [availableTags]
  );

  const removeTagFilter = useCallback((tag: string) => {
    setActiveTagFilters((prev) => prev.filter((t) => t !== tag));
  }, []);

  const upsertCard = useCallback((card: ImageItem) => {
    setImages((prev) => {
      const idx = prev.findIndex((c) => c.id === card.id);
      if (idx === -1) return [card, ...prev];
      const next = [...prev];
      next[idx] = card;
      return next;
    });
  }, []);

  const handleProcessFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter((f) => f.type.startsWith('image/'));
    for (const file of fileArray) {
      try {
        const rawDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const { blob, width, height, ratio } = await new Promise<{
          blob: Blob;
          width: number;
          height: number;
          ratio: number;
        }>((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            const maxDim = 1400;
            let width = img.width;
            let height = img.height;
            if (width > maxDim || height > maxDim) {
              if (width > height) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              } else {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            let out = rawDataUrl;
            if (ctx) {
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, width, height);
              ctx.drawImage(img, 0, 0, width, height);
              out = canvas.toDataURL('image/jpeg', 0.82);
            }
            resolve({
              blob: dataUrlToBlob(out),
              width,
              height,
              ratio: width / height,
            });
          };
          img.onerror = reject;
          img.src = rawDataUrl;
        });

        const { card } = await api.createCard({
          title: file.name.replace(/\.[^/.]+$/, ''),
          kind: 'image',
          tags: ['Upload'],
          source: 'uploaded',
          folderId: selectedFolderIdRef.current,
          width,
          height,
          aspectRatio: ratio,
          file: blob,
          fileName: file.name.replace(/\.[^/.]+$/, '') + '.jpg',
        });
        upsertCard(card);
      } catch (err) {
        console.error('Upload failed', err);
        setLoadError(err instanceof Error ? err.message : 'Upload failed');
      }
    }
  };

  const handleAddFromUrl = async (url: string, title?: string, tags?: string[]) => {
    try {
      const dims = await new Promise<{ w: number; h: number }>((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ w: img.width, h: img.height });
        img.onerror = () => resolve({ w: 0, h: 0 });
        img.src = url;
      });
      const aspectRatio = dims.w && dims.h ? dims.w / dims.h : 1.2;
      const { card } = await api.createCard({
        title: title || 'Image Web',
        kind: 'image',
        tags: tags && tags.length > 0 ? tags : ['Web'],
        source: 'url',
        url,
        folderId: selectedFolderIdRef.current,
        aspectRatio,
        width: dims.w || undefined,
        height: dims.h || undefined,
      });
      upsertCard(card);
    } catch (err) {
      console.error(err);
      setLoadError(err instanceof Error ? err.message : 'Add URL failed');
    }
  };

  const handleAddNote = async (markdown: string, title?: string, tags?: string[]) => {
    try {
      const { card } = await api.createCard({
        title: title || 'Note',
        kind: 'note',
        markdown,
        tags: tags && tags.length > 0 ? tags : ['Note'],
        source: 'note',
        folderId: selectedFolderIdRef.current,
        aspectRatio: 1,
      });
      upsertCard(card);
      setSelectedImageId(card.id);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Note create failed');
    }
  };

  const handleUpdateNote = useCallback(
    async (id: string, data: { title?: string; markdown?: string; additionalNotes?: string }) => {
      setImages((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                ...(data.title !== undefined ? { title: data.title } : {}),
                ...(data.markdown !== undefined ? { markdown: data.markdown } : {}),
                ...(data.additionalNotes !== undefined
                  ? { additionalNotes: data.additionalNotes }
                  : {}),
              }
            : item
        )
      );
      try {
        const { card } = await api.updateCard(id, data);
        upsertCard(card);
      } catch (err) {
        console.error(err);
      }
    },
    [upsertCard]
  );

  const handleUpdateDrawing = useCallback(
    async (id: string, drawingData: string | null) => {
      setImages((prev) =>
        prev.map((item) => {
          if (item.id !== id) return item;
          if (!drawingData) {
            const { drawingData: _removed, ...rest } = item;
            return rest;
          }
          return { ...item, drawingData };
        })
      );
      try {
        const { card } = await api.updateCard(id, { drawingData });
        upsertCard(card);
      } catch (err) {
        console.error(err);
      }
    },
    [upsertCard]
  );

  const handleCreateFolder = useCallback(async (name: string, icon: string) => {
    const { folder } = await api.createFolder(name, icon);
    setFolders((prev) => [...prev, folder]);
    return folder.id;
  }, []);

  const handleMoveItemsToFolder = useCallback(async (itemIds: string[], folderId: string) => {
    setImages((prev) =>
      prev.map((img) => (itemIds.includes(img.id) ? { ...img, folderId } : img))
    );
    try {
      await api.moveCards(itemIds, folderId);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const clearSelectionDock = useCallback(() => {
    setSelectionDockIds([]);
    setIsOverSelectionDock(false);
  }, []);

  const addToSelectionDock = useCallback((itemId: string) => {
    setSelectionDockIds((prev) => (prev.includes(itemId) ? prev : [...prev, itemId]));
  }, []);

  const handleAssignSelectionToFolder = useCallback(
    (folderId: string) => {
      if (selectionDockIds.length === 0) return;
      void handleMoveItemsToFolder(selectionDockIds, folderId);
      clearSelectionDock();
    },
    [selectionDockIds, handleMoveItemsToFolder, clearSelectionDock]
  );

  const handleCreateFolderAndAssign = useCallback(
    async (name: string, icon: string) => {
      const folderId = await handleCreateFolder(name, icon);
      handleAssignSelectionToFolder(folderId);
    },
    [handleCreateFolder, handleAssignSelectionToFolder]
  );

  const handleCreateMoodboard = useCallback(async () => {
    if (selectionDockIds.length === 0) return;
    const canvasAR =
      typeof window !== 'undefined'
        ? window.innerWidth / Math.max(window.innerHeight - 72, 1)
        : 1.6;

    const placements: MoodboardPlacement[] = selectionDockIds.map((itemId, i) => {
      const source = images.find((img) => img.id === itemId);
      const aspectRatio = source ? getItemAspectRatio(source) : 1;
      const { width, height } = placementSizeFromAspect(aspectRatio, canvasAR);
      const col = i % 3;
      const row = Math.floor(i / 3);
      return {
        itemId,
        x: Math.min(8 + col * 30, 100 - width),
        y: Math.min(8 + row * 34, 100 - height),
        width,
        height,
        rotation: (i - selectionDockIds.length / 2) * 3,
        zIndex: i + 1,
      };
    });

    try {
      const { card } = await api.createCard({
        title: 'Moodboard',
        kind: 'moodboard',
        tags: ['Moodboard'],
        source: 'default',
        folderId: selectedFolderIdRef.current,
        aspectRatio: 1.35,
        moodboardPlacements: placements,
      });
      upsertCard(card);
      setSelectedImageId(card.id);
      clearSelectionDock();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Moodboard failed');
    }
  }, [selectionDockIds, images, clearSelectionDock, upsertCard]);

  const handleUpdateMoodboard = useCallback(
    async (id: string, data: { title?: string; moodboardPlacements?: MoodboardPlacement[] }) => {
      setImages((prev) => prev.map((item) => (item.id === id ? { ...item, ...data } : item)));
      try {
        const { card } = await api.updateCard(id, data);
        upsertCard(card);
      } catch (err) {
        console.error(err);
      }
    },
    [upsertCard]
  );

  const handleSelectionDockDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsOverSelectionDock(false);
      setIsCardDragging(false);
      const itemId = getDraggedItemId(e);
      if (!itemId) return;
      const item = images.find((i) => i.id === itemId);
      if (item && !isMoodboardItem(item)) addToSelectionDock(itemId);
    },
    [addToSelectionDock, images]
  );

  const handleToggleFavorite = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const current = images.find((i) => i.id === id);
      if (!current) return;
      const next = !current.isFavorite;
      setImages((prev) =>
        prev.map((img) => (img.id === id ? { ...img, isFavorite: next } : img))
      );
      try {
        const { card } = await api.updateCard(id, { isFavorite: next });
        upsertCard(card);
      } catch (err) {
        console.error(err);
      }
    },
    [images, upsertCard]
  );

  const handleDeleteImage = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setImages((prev) => prev.filter((img) => img.id !== id));
      if (selectedImageId === id) setSelectedImageId(null);
      try {
        await api.deleteCard(id);
      } catch (err) {
        console.error(err);
      }
    },
    [selectedImageId]
  );

  const handleAddTag = async (id: string, newTag: string) => {
    const current = images.find((i) => i.id === id);
    if (!current) return;
    const existingTags = current.tags || [];
    if (existingTags.includes(newTag)) return;
    const tags = [...existingTags, newTag];
    setImages((prev) => prev.map((img) => (img.id === id ? { ...img, tags } : img)));
    try {
      const { card } = await api.updateCard(id, { tags });
      upsertCard(card);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveTag = async (id: string, tagToRemove: string) => {
    const current = images.find((i) => i.id === id);
    if (!current) return;
    const tags = (current.tags || []).filter((t) => t !== tagToRemove);
    setImages((prev) => prev.map((img) => (img.id === id ? { ...img, tags } : img)));
    try {
      const { card } = await api.updateCard(id, { tags });
      upsertCard(card);
    } catch (err) {
      console.error(err);
    }
  };

  const folderItemCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    images.forEach((img) => {
      if (img.folderId) counts[img.folderId] = (counts[img.folderId] || 0) + 1;
    });
    return counts;
  }, [images]);

  const showSelectionDock = isCardDragging || selectionDockIds.length > 0;

  const filteredImages = useMemo(() => {
    return images.filter((img) => {
      if (isFavoriteFilterActive && !img.isFavorite) return false;
      if (selectedFolderId && img.folderId !== selectedFolderId) return false;
      if (activeTagFilters.length > 0) {
        const itemTags = img.tags || [];
        const matchesAllTags = activeTagFilters.every((filter) =>
          itemTags.some((t) => t.toLowerCase() === filter.toLowerCase())
        );
        if (!matchesAllTags) return false;
      }
      const trimmedQuery = searchQuery.trim();
      if (trimmedQuery && !trimmedQuery.startsWith('#')) {
        const query = trimmedQuery.toLowerCase();
        const matchesTitle = img.title.toLowerCase().includes(query);
        const matchesTag = img.tags?.some((t) => t.toLowerCase().includes(query));
        const matchesMarkdown = img.markdown?.toLowerCase().includes(query);
        const matchesNotes = img.additionalNotes?.toLowerCase().includes(query);
        const matchesFilename = img.filename?.toLowerCase().includes(query);
        if (
          !matchesTitle &&
          !matchesTag &&
          !matchesMarkdown &&
          !matchesNotes &&
          !matchesFilename
        ) {
          return false;
        }
      }
      return true;
    });
  }, [images, isFavoriteFilterActive, selectedFolderId, searchQuery, activeTagFilters]);

  const selectedItem = useMemo(
    () => images.find((img) => img.id === selectedImageId) || null,
    [images, selectedImageId]
  );
  const selectedImage = selectedItem && isImageItem(selectedItem) ? selectedItem : null;
  const selectedNote = selectedItem && isNoteItem(selectedItem) ? selectedItem : null;
  const selectedMoodboard =
    selectedItem && isMoodboardItem(selectedItem) ? selectedItem : null;

  const handleLogout = () => {
    setToken(null);
    setAuthed(false);
    setProfile(null);
    setImages([]);
    setFolders([]);
    setIsAccountOpen(false);
    void api.logout().catch(() => undefined);
  };

  const handleAuthenticated = async (p: UserProfile) => {
    setProfile(p);
    setAuthed(true);
    try {
      const [me, cardsRes, foldersRes] = await Promise.all([
        api.me(),
        api.listCards(),
        api.listFolders(),
      ]);
      applyMeStorage(me, storageSetters);
      setImages(cardsRes.cards);
      setFolders(foldersRes.folders);
      void maybeBackgroundSync();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Load failed');
    }
  };

  const updateBanner = (
    <AnimatePresence>
      {updateAvailable && (
        <UpdateBanner
          builtAt={builtAt}
          updating={updating}
          onUpdate={() => void applyUpdate()}
          onDismiss={dismissUpdateBanner}
        />
      )}
    </AnimatePresence>
  );

  if (bootstrapping) {
    return (
      <>
        {updateBanner}
        <div
          className="min-h-screen flex items-center justify-center text-zinc-900 dark:text-zinc-50"
          role="status"
          aria-label="Chargement"
        >
          <CobeaLogoMark className="w-14 h-14 animate-spin" title="Chargement" />
        </div>
      </>
    );
  }

  if (!authed || !profile) {
    return (
      <>
        {updateBanner}
        <AuthScreen onAuthenticated={handleAuthenticated} />
      </>
    );
  }

  return (
    <div
      className={`min-h-screen selection:bg-amber-400 selection:text-zinc-950 transition-[padding] duration-300 ${
        showSelectionDock ? 'pb-0' : 'pb-28'
      }`}
    >
      {updateBanner}
      <DropOverlay isDragging={isDragging} />

      {loadError && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[90] rounded-xl bg-rose-600 text-white text-sm px-4 py-2 shadow-lg">
          {loadError}
          <button type="button" className="ml-3 underline" onClick={() => setLoadError(null)}>
            OK
          </button>
        </div>
      )}

      {!isAccountOpen && (
        <ProfileAvatarButton profile={profile} onClick={() => setIsAccountOpen(true)} />
      )}

      <AnimatePresence>
        {isAccountOpen && (
          <AccountPanel
            profile={profile}
            theme={theme}
            onThemeChange={setTheme}
            columnCount={columnCount}
            onColumnCountChange={setColumnCount}
            googleConnected={googleConnected}
            storageMode={storageMode}
            googleConfigured={googleConfigured}
            googleUploadFolderId={googleUploadFolderId}
            googleUploadFolderName={googleUploadFolderName}
            googleSyncFolders={googleSyncFolders}
            googleLastSyncAt={googleLastSyncAt}
            onClose={() => setIsAccountOpen(false)}
            onLogout={handleLogout}
            onGoogleChange={setGoogleConnected}
            onStorageChange={applyStoragePartial}
            onSynced={() => void refreshGallery()}
          />
        )}
      </AnimatePresence>

      <CardSelectionDock
        isVisible={showSelectionDock}
        selectedIds={selectionDockIds}
        items={images}
        isDragActive={isCardDragging}
        isApproaching={isNearSelectionDock}
        isOver={isOverSelectionDock}
        folders={folders}
        folderItemCounts={folderItemCounts}
        onCreateFolder={handleCreateFolderAndAssign}
        onAssignFolder={handleAssignSelectionToFolder}
        onCreateMoodboard={handleCreateMoodboard}
        onRemoveItem={(id) => setSelectionDockIds((prev) => prev.filter((x) => x !== id))}
        onClear={clearSelectionDock}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = 'move';
          setIsOverSelectionDock(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsOverSelectionDock(false);
        }}
        onDrop={handleSelectionDockDrop}
      />

      <ZenHeader
        selectedFolderId={selectedFolderId}
        onSelectFolder={setSelectedFolderId}
        folders={folders}
        isFavoriteFilterActive={isFavoriteFilterActive}
        onToggleFavoriteFilter={() => setIsFavoriteFilterActive(!isFavoriteFilterActive)}
        zenMode={zenMode}
        onOpenUpload={() => setIsAddModalOpen(true)}
      />

      <main>
        <MasonryGrid
          images={filteredImages}
          allItems={images}
          columnCountOverride={columnCount}
          onSelectImage={(img) => setSelectedImageId(img.id)}
          onToggleFavorite={handleToggleFavorite}
          onDeleteImage={handleDeleteImage}
          onOpenUpload={() => setIsAddModalOpen(true)}
          onDragStartItem={() => setIsCardDragging(true)}
          onDragEndItem={() => {
            setIsCardDragging(false);
            setIsNearSelectionDock(false);
            setIsOverSelectionDock(false);
          }}
        />
      </main>

      <BottomNavbar
        onOpenUpload={() => setIsAddModalOpen(true)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeTagFilters={activeTagFilters}
        onCommitTagFilter={(tag) => {
          if (commitTagFilter(tag)) setSearchQuery('');
        }}
        onRemoveTagFilter={removeTagFilter}
        zenMode={zenMode}
        onToggleZenMode={() => void handleToggleZenMode()}
        totalImagesCount={filteredImages.length}
        hiddenForSelection={showSelectionDock}
        typeToSearchEnabled={!selectedImageId && !isAddModalOpen && !isAccountOpen}
      />

      <ImageModal
        image={selectedImage}
        onClose={() => setSelectedImageId(null)}
        onToggleFavorite={handleToggleFavorite}
        onDelete={handleDeleteImage}
        onAddTag={handleAddTag}
        onRemoveTag={handleRemoveTag}
        onUpdateDrawing={handleUpdateDrawing}
      />

      <NoteModal
        note={selectedNote}
        onClose={() => setSelectedImageId(null)}
        onToggleFavorite={handleToggleFavorite}
        onDelete={handleDeleteImage}
        onAddTag={handleAddTag}
        onRemoveTag={handleRemoveTag}
        onUpdateNote={handleUpdateNote}
        onUpdateDrawing={handleUpdateDrawing}
      />

      <MoodboardModal
        moodboard={selectedMoodboard}
        allItems={images}
        onClose={() => setSelectedImageId(null)}
        onUpdateMoodboard={handleUpdateMoodboard}
        onUpdateDrawing={handleUpdateDrawing}
      />

      <AddImageModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddFromUrl={(url, title, tags) => void handleAddFromUrl(url, title, tags)}
        onAddFiles={(files) => void handleProcessFiles(files)}
        onAddNote={(md, title, tags) => void handleAddNote(md, title, tags)}
      />
    </div>
  );
}
