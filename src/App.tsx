import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AnimatePresence } from 'motion/react';
import { ImageItem, ThemeMode, Folder, MoodboardPlacement, isNoteItem, isImageItem, isMoodboardItem } from './types';
import { INITIAL_IMAGES } from './data/initialImages';
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
import { AccountSwitcher } from './components/AccountSwitcher';
import { ITEM_DRAG_MIME } from './hooks/useCardDragPreview';
import { placementSizeFromAspect, getItemAspectRatio } from './components/MoodboardCardFrame';
import { PROFILES, PROFILE_STORAGE_KEY, getStoredProfileId } from './data/profiles';

const STORAGE_KEY = 'zen_gallery_images_v1';
const FOLDERS_KEY = 'zen_gallery_folders_v1';
const THEME_KEY = 'zen_gallery_theme_v1';

export default function App() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem(THEME_KEY);
    return (saved as ThemeMode) || 'light';
  });

  const [activeProfileId, setActiveProfileId] = useState(getStoredProfileId);
  const [isAccountSwitcherOpen, setIsAccountSwitcherOpen] = useState(false);

  const [images, setImages] = useState<ImageItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (err) {
      console.error('Error loading gallery from localStorage:', err);
    }
    return INITIAL_IMAGES;
  });

  const [folders, setFolders] = useState<Folder[]>(() => {
    try {
      const saved = localStorage.getItem(FOLDERS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (err) {
      console.error('Error loading folders from localStorage:', err);
    }
    return [];
  });

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
  const [columnCount, setColumnCount] = useState<number>(4);

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
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
    } catch (err) {
      console.error('Error saving folders:', err);
    }
  }, [folders]);

  useEffect(() => {
    const saveToStorage = (items: ImageItem[]) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
        return true;
      } catch {
        return false;
      }
    };

    if (!saveToStorage(images)) {
      const lighterItems = images.map((img, idx) => {
        if (img.url?.startsWith('data:image/') && idx > 5) {
          return { ...img, url: img.url };
        }
        return img;
      });

      if (!saveToStorage(lighterItems)) {
        saveToStorage(
          images.filter((i) => isNoteItem(i) || !i.url?.startsWith('data:image/')).slice(0, 30)
        );
      }
    }
  }, [images]);

  useEffect(() => {
    let dragCounter = 0;

    const isInternalCardDrag = (dt: DataTransfer | null) => {
      if (!dt) return false;
      const types = Array.from(dt.types);
      return types.includes(ITEM_DRAG_MIME);
    };

    const isExternalImageDrop = (dt: DataTransfer | null) => {
      if (!dt || isInternalCardDrag(dt)) return false;
      const types = Array.from(dt.types);
      // Only accept real external file / URL drops — not in-app card moves
      return types.includes('Files') || types.includes('text/uri-list');
    };

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      if (isInternalCardDrag(e.dataTransfer)) return;
      dragCounter++;
      if (isExternalImageDrop(e.dataTransfer)) {
        setIsDragging(true);
      }
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

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounter = 0;
      setIsDragging(false);

      // Internal card drag (move to folder) must never create a new card
      if (isInternalCardDrag(e.dataTransfer)) return;

      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        handleProcessFiles(e.dataTransfer.files);
        return;
      }

      // External image URL from another website
      const uri =
        e.dataTransfer?.getData('text/uri-list')?.split('\n').find((l) => l && !l.startsWith('#')) ||
        e.dataTransfer?.getData('text/plain');
      if (uri && (uri.startsWith('http://') || uri.startsWith('https://'))) {
        handleAddFromUrl(uri, 'Image externe', ['Web']);
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
  }, []);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (e.clipboardData?.files && e.clipboardData.files.length > 0) {
        const imageFiles = Array.from(e.clipboardData.files).filter((file) =>
          file.type.startsWith('image/')
        );
        if (imageFiles.length > 0) {
          handleProcessFiles(imageFiles);
          return;
        }
      }

      const pastedText = e.clipboardData?.getData('text');
      if (pastedText && (pastedText.startsWith('http://') || pastedText.startsWith('https://'))) {
        handleAddFromUrl(pastedText, 'Image collée', ['Collé']);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const availableTags = useMemo(() => {
    const tagsSet = new Set<string>();
    images.forEach((img) => {
      if (img.tags) img.tags.forEach((t) => tagsSet.add(t));
    });
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isInputActive =
        activeElement &&
        (activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          (activeElement as HTMLElement).isContentEditable);

      if (isInputActive || selectedImageId !== null || isAddModalOpen) {
        return;
      }

      if (e.key === 'Escape') {
        if (searchQuery) {
          setSearchQuery('');
          e.preventDefault();
        } else if (activeTagFilters.length > 0) {
          setActiveTagFilters([]);
          e.preventDefault();
        }
        return;
      }

      if (e.key === 'Enter') {
        const trimmed = searchQuery.trim();
        if (trimmed.startsWith('#') && trimmed.length > 1) {
          if (commitTagFilter(trimmed.slice(1))) {
            setSearchQuery('');
            e.preventDefault();
          }
        }
        return;
      }

      if (e.key === 'Backspace') {
        if (searchQuery.length > 0) {
          setSearchQuery((prev) => prev.slice(0, -1));
          e.preventDefault();
        } else if (activeTagFilters.length > 0) {
          setActiveTagFilters((prev) => prev.slice(0, -1));
          e.preventDefault();
        }
        return;
      }

      if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }

      setSearchQuery((prev) => prev + e.key);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedImageId, isAddModalOpen, searchQuery, activeTagFilters, commitTagFilter]);

  const handleProcessFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    fileArray.forEach((file) => {
      if (!file.type.startsWith('image/')) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const rawDataUrl = event.target?.result as string;
        if (!rawDataUrl) return;

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

          let compressedUrl = rawDataUrl;
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            compressedUrl = canvas.toDataURL('image/jpeg', 0.82);
          }

          const ratio = width / height;
          const newImageItem: ImageItem = {
            id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            url: compressedUrl,
            title: file.name.replace(/\.[^/.]+$/, ''),
            aspectRatio: ratio,
            createdAt: Date.now(),
            tags: ['Upload'],
            source: 'uploaded',
            kind: 'image',
            folderId: selectedFolderId,
            width,
            height,
          };

          setImages((prev) => [newImageItem, ...prev]);
        };
        img.src = rawDataUrl;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleAddFromUrl = (url: string, title?: string, tags?: string[]) => {
    const img = new Image();
    img.onload = () => {
      const ratio = img.width / img.height;
      const newImageItem: ImageItem = {
        id: `img-url-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        url,
        title: title || 'Image Web',
        aspectRatio: ratio,
        createdAt: Date.now(),
        tags: tags && tags.length > 0 ? tags : ['Web'],
        source: 'url',
        kind: 'image',
        folderId: selectedFolderId,
      };
      setImages((prev) => [newImageItem, ...prev]);
    };
    img.onerror = () => {
      const newImageItem: ImageItem = {
        id: `img-url-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        url,
        title: title || 'Image Web',
        aspectRatio: 1.2,
        createdAt: Date.now(),
        tags: tags && tags.length > 0 ? tags : ['Web'],
        source: 'url',
        kind: 'image',
        folderId: selectedFolderId,
      };
      setImages((prev) => [newImageItem, ...prev]);
    };
    img.src = url;
  };

  const handleAddNote = (markdown: string, title?: string, tags?: string[]) => {
    const newNote: ImageItem = {
      id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      url: '',
      title: title || 'Note',
      markdown,
      kind: 'note',
      aspectRatio: 1,
      createdAt: Date.now(),
      tags: tags && tags.length > 0 ? tags : ['Note'],
      source: 'note',
      folderId: selectedFolderId,
    };
    setImages((prev) => [newNote, ...prev]);
    setSelectedImageId(newNote.id);
  };

  const handleUpdateNote = useCallback(
    (id: string, data: { title?: string; markdown?: string; additionalNotes?: string }) => {
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
    },
    []
  );

  const handleUpdateDrawing = useCallback((id: string, drawingData: string | null) => {
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
  }, []);

  const handleCreateFolder = useCallback((name: string, icon: string) => {
    const folder: Folder = {
      id: `folder-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      name,
      icon,
      createdAt: Date.now(),
    };
    setFolders((prev) => [...prev, folder]);
    return folder.id;
  }, []);

  const handleMoveItemsToFolder = useCallback((itemIds: string[], folderId: string) => {
    setImages((prev) =>
      prev.map((img) => (itemIds.includes(img.id) ? { ...img, folderId } : img))
    );
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
      handleMoveItemsToFolder(selectionDockIds, folderId);
      clearSelectionDock();
    },
    [selectionDockIds, handleMoveItemsToFolder, clearSelectionDock]
  );

  const handleCreateFolderAndAssign = useCallback(
    (name: string, icon: string) => {
      const folderId = handleCreateFolder(name, icon);
      handleAssignSelectionToFolder(folderId);
    },
    [handleCreateFolder, handleAssignSelectionToFolder]
  );

  const handleCreateMoodboard = useCallback(() => {
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

    const moodboard: ImageItem = {
      id: `moodboard-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      url: '',
      title: 'Moodboard',
      kind: 'moodboard',
      moodboardPlacements: placements,
      aspectRatio: 1.35,
      createdAt: Date.now(),
      tags: ['Moodboard'],
      source: 'default',
      folderId: selectedFolderId,
    };

    setImages((prev) => [moodboard, ...prev]);
    setSelectedImageId(moodboard.id);
    clearSelectionDock();
  }, [selectionDockIds, selectedFolderId, clearSelectionDock, images]);

  const handleUpdateMoodboard = useCallback(
    (id: string, data: { title?: string; moodboardPlacements?: MoodboardPlacement[] }) => {
      setImages((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...data } : item))
      );
    },
    []
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
      if (item && !isMoodboardItem(item)) {
        addToSelectionDock(itemId);
      }
    },
    [addToSelectionDock, images]
  );

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const handleToggleFavorite = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setImages((prev) =>
      prev.map((img) =>
        img.id === id ? { ...img, isFavorite: !img.isFavorite } : img
      )
    );
  }, []);

  const handleDeleteImage = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setImages((prev) => prev.filter((img) => img.id !== id));
      if (selectedImageId === id) setSelectedImageId(null);
    },
    [selectedImageId]
  );

  const handleAddTag = (id: string, newTag: string) => {
    setImages((prev) =>
      prev.map((img) => {
        if (img.id !== id) return img;
        const existingTags = img.tags || [];
        if (existingTags.includes(newTag)) return img;
        return { ...img, tags: [...existingTags, newTag] };
      })
    );
  };

  const handleRemoveTag = (id: string, tagToRemove: string) => {
    setImages((prev) =>
      prev.map((img) => {
        if (img.id !== id) return img;
        return {
          ...img,
          tags: (img.tags || []).filter((t) => t !== tagToRemove),
        };
      })
    );
  };

  const folderItemCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    images.forEach((img) => {
      if (img.folderId) {
        counts[img.folderId] = (counts[img.folderId] || 0) + 1;
      }
    });
    return counts;
  }, [images]);


  const showSelectionDock = isCardDragging || selectionDockIds.length > 0;

  const filteredImages = useMemo(() => {
    return images.filter((img) => {
      if (isFavoriteFilterActive && !img.isFavorite) return false;

      if (selectedFolderId && img.folderId !== selectedFolderId) {
        return false;
      }

      if (activeTagFilters.length > 0) {
        const itemTags = img.tags || [];
        const matchesAllTags = activeTagFilters.every((filter) =>
          itemTags.some((t) => t.toLowerCase() === filter.toLowerCase())
        );
        if (!matchesAllTags) return false;
      }

      const trimmedQuery = searchQuery.trim();
      // While composing a #tag filter, don't apply text search
      if (trimmedQuery && !trimmedQuery.startsWith('#')) {
        const query = trimmedQuery.toLowerCase();
        const matchesTitle = img.title.toLowerCase().includes(query);
        const matchesTag = img.tags?.some((t) => t.toLowerCase().includes(query));
        const matchesMarkdown = img.markdown?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesTag && !matchesMarkdown) return false;
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

  const activeProfile = useMemo(
    () => PROFILES.find((p) => p.id === activeProfileId) ?? PROFILES[0],
    [activeProfileId]
  );

  useEffect(() => {
    try {
      localStorage.setItem(PROFILE_STORAGE_KEY, activeProfileId);
    } catch (err) {
      console.error('Error saving active profile:', err);
    }
  }, [activeProfileId]);

  const handleSelectProfile = useCallback((id: string) => {
    setActiveProfileId(id);
    setIsAccountSwitcherOpen(false);
  }, []);

  return (
    <div
      className={`min-h-screen selection:bg-amber-400 selection:text-zinc-950 transition-[padding] duration-300 ${
        showSelectionDock ? 'pb-0' : 'pb-28'
      }`}
    >
      <DropOverlay isDragging={isDragging} />

      {!isAccountSwitcherOpen && (
        <ProfileAvatarButton
          profile={activeProfile}
          onClick={() => setIsAccountSwitcherOpen(true)}
        />
      )}

      <AnimatePresence>
        {isAccountSwitcherOpen && (
          <AccountSwitcher
            profiles={PROFILES}
            activeProfileId={activeProfileId}
            onSelectProfile={handleSelectProfile}
            onClose={() => setIsAccountSwitcherOpen(false)}
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
        onRemoveItem={(id) =>
          setSelectionDockIds((prev) => prev.filter((x) => x !== id))
        }
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
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onOpenUpload={() => setIsAddModalOpen(true)}
        isFavoriteFilterActive={isFavoriteFilterActive}
        onToggleFavoriteFilter={() => setIsFavoriteFilterActive(!isFavoriteFilterActive)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeTagFilters={activeTagFilters}
        onCommitTagFilter={(tag) => {
          if (commitTagFilter(tag)) setSearchQuery('');
        }}
        onRemoveTagFilter={removeTagFilter}
        zenMode={zenMode}
        onToggleZenMode={() => setZenMode(!zenMode)}
        columnCount={columnCount}
        onChangeColumnCount={setColumnCount}
        totalImagesCount={images.length}
        hiddenForSelection={showSelectionDock}
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
        onAddFromUrl={handleAddFromUrl}
        onAddFiles={handleProcessFiles}
        onAddNote={handleAddNote}
      />
    </div>
  );
}
