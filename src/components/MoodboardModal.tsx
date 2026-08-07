import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, LayoutGrid, StickyNote } from 'lucide-react';
import { ImageItem, MoodboardPlacement } from '../types';
import { DetailDrawingLayer } from './drawing/DetailDrawingLayer';
import { CobeaLogoMark } from './CobeaBrand';
import { isDisplayableImageItem } from './FileCardPreview';
import {
  MoodboardCardFrame,
  CardInteraction,
  applyCardInteraction,
  getCardCenter,
  getItemAspectRatio,
  heightFromWidth,
} from './MoodboardCardFrame';

interface MoodboardModalProps {
  moodboard: ImageItem | null;
  allItems: ImageItem[];
  onClose: () => void;
  onUpdateMoodboard: (
    id: string,
    data: {
      title?: string;
      moodboardPlacements?: MoodboardPlacement[];
      additionalNotes?: string;
    }
  ) => void;
  onUpdateDrawing: (id: string, data: string | null) => void;
  onCardUpdated?: (card: ImageItem) => void;
}

type MoodboardInteractionMode = 'cursor' | 'draw';

interface PanState {
  startX: number;
  startY: number;
  origX: number;
  origY: number;
}

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const DOT_GRID = 24;
const READY_TIMEOUT_MS = 5000;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function preloadImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = url;
  });
}

export const MoodboardModal: React.FC<MoodboardModalProps> = ({
  moodboard,
  allItems,
  onClose,
  onUpdateMoodboard,
  onUpdateDrawing,
  onCardUpdated,
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [notesOpen, setNotesOpen] = useState(false);
  const [placements, setPlacements] = useState<MoodboardPlacement[]>([]);
  const [interactionMode, setInteractionMode] = useState<MoodboardInteractionMode>('cursor');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [resolvedAspects, setResolvedAspects] = useState<Record<string, number>>({});
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [drawingReady, setDrawingReady] = useState(false);
  const [assetsReady, setAssetsReady] = useState(false);
  const interactionRef = useRef<CardInteraction | null>(null);
  const panRef = useRef<PanState | null>(null);
  const panOffsetRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  panOffsetRef.current = pan;
  zoomRef.current = zoom;

  const contentReady = drawingReady && assetsReady;

  useEffect(() => {
    if (!moodboard) return;
    setTitle(moodboard.title || 'Moodboard');
    setAdditionalNotes(moodboard.additionalNotes || '');
    setNotesOpen(false);
    setPlacements(moodboard.moodboardPlacements || []);
    setInteractionMode('cursor');
    setSelectedId(null);
    setResolvedAspects({});
    setPan({ x: 0, y: 0 });
    setZoom(1);
    panRef.current = null;
    setIsPanning(false);
    setDrawingReady(false);
    setAssetsReady(false);
  }, [moodboard?.id]);

  useEffect(() => {
    if (!moodboard) return;
    if (additionalNotes === (moodboard.additionalNotes || '')) return;
    const timer = window.setTimeout(() => {
      onUpdateMoodboard(moodboard.id, { additionalNotes });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [additionalNotes, moodboard, onUpdateMoodboard]);

  // Preload card images so they appear with the drawing layer
  useEffect(() => {
    if (!moodboard) return;
    let cancelled = false;
    const itemById = new Map(allItems.map((i) => [i.id, i]));
    const urls = (moodboard.moodboardPlacements || [])
      .map((p) => itemById.get(p.itemId))
      .filter((item): item is ImageItem => Boolean(item))
      .filter((item) => isDisplayableImageItem(item) && Boolean(item.url))
      .map((item) => item.url);

    const unique = [...new Set(urls)];
    const finish = () => {
      if (!cancelled) setAssetsReady(true);
    };

    if (unique.length === 0) {
      finish();
      return () => {
        cancelled = true;
      };
    }

    void Promise.all(unique.map(preloadImage)).then(finish);
    const timeout = window.setTimeout(finish, READY_TIMEOUT_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when opening a board
  }, [moodboard?.id, allItems]);

  // Safety: never block the UI forever if drawing ready never fires
  useEffect(() => {
    if (!moodboard || drawingReady) return;
    const timeout = window.setTimeout(() => setDrawingReady(true), READY_TIMEOUT_MS);
    return () => window.clearTimeout(timeout);
  }, [moodboard?.id, moodboard, drawingReady]);

  useEffect(() => {
    if (!moodboard) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [moodboard]);

  // Middle-mouse pan anywhere (including over cards / while drawing)
  useEffect(() => {
    if (!moodboard) return;

    const isChromeTarget = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return true;
      return !!target.closest(
        'header, button, input, textarea, a, .iro-color-picker-panel, .drawing-tool-tray, [data-drawing-chrome]'
      );
    };

    const endPan = () => {
      if (!panRef.current) return;
      panRef.current = null;
      setIsPanning(false);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 1) return;
      if (isChromeTarget(e.target)) return;

      e.preventDefault();
      e.stopPropagation();

      interactionRef.current = null;
      panRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX: panOffsetRef.current.x,
        origY: panOffsetRef.current.y,
      };
      setIsPanning(true);
    };

    const onPointerMove = (e: PointerEvent) => {
      const panState = panRef.current;
      if (!panState) return;
      setPan({
        x: panState.origX + (e.clientX - panState.startX),
        y: panState.origY + (e.clientY - panState.startY),
      });
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.button === 1 || panRef.current) endPan();
    };

    // Block browser autoscroll on middle-click
    const onAuxClick = (e: MouseEvent) => {
      if (e.button === 1) e.preventDefault();
    };
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 1 && !isChromeTarget(e.target)) e.preventDefault();
    };

    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('pointermove', onPointerMove, true);
    window.addEventListener('pointerup', onPointerUp, true);
    window.addEventListener('pointercancel', onPointerUp, true);
    window.addEventListener('auxclick', onAuxClick, true);
    window.addEventListener('mousedown', onMouseDown, true);

    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('pointermove', onPointerMove, true);
      window.removeEventListener('pointerup', onPointerUp, true);
      window.removeEventListener('pointercancel', onPointerUp, true);
      window.removeEventListener('auxclick', onAuxClick, true);
      window.removeEventListener('mousedown', onMouseDown, true);
    };
  }, [moodboard]);

  // Mouse wheel zoom toward cursor
  useEffect(() => {
    if (!moodboard) return;

    const onWheel = (e: WheelEvent) => {
      const layer = layerRef.current;
      if (!layer) return;
      if (!(e.target instanceof Node) || !layer.contains(e.target)) return;
      if ((e.target as Element).closest?.('header, button, input, .iro-color-picker-panel, [data-drawing-chrome]')) {
        return;
      }

      e.preventDefault();

      const rect = layer.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const prevZoom = zoomRef.current;
      const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
      const nextZoom = clamp(prevZoom * factor, MIN_ZOOM, MAX_ZOOM);
      if (Math.abs(nextZoom - prevZoom) < 0.0001) return;

      const panNow = panOffsetRef.current;
      // Keep the world point under the cursor stable
      const worldX = (mx - panNow.x) / prevZoom;
      const worldY = (my - panNow.y) / prevZoom;
      const nextPan = {
        x: mx - worldX * nextZoom,
        y: my - worldY * nextZoom,
      };

      zoomRef.current = nextZoom;
      panOffsetRef.current = nextPan;
      setZoom(nextZoom);
      setPan(nextPan);
    };

    window.addEventListener('wheel', onWheel, { passive: false, capture: true });
    return () => window.removeEventListener('wheel', onWheel, true);
  }, [moodboard]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!moodboard) return;
      if (e.key === 'Escape') {
        if (selectedId) {
          setSelectedId(null);
          e.preventDefault();
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [moodboard, onClose, selectedId]);

  const placementsRef = useRef(placements);
  placementsRef.current = placements;

  const persistPlacements = () => {
    if (!moodboard) return;
    onUpdateMoodboard(moodboard.id, { moodboardPlacements: placementsRef.current });
  };

  const selectCard = (itemId: string) => {
    setSelectedId(itemId);
    setPlacements((prev) => {
      const maxZ = prev.reduce((m, p) => Math.max(m, p.zIndex ?? 1), 0);
      return prev.map((p) =>
        p.itemId === itemId ? { ...p, zIndex: maxZ + 1 } : p
      );
    });
  };

  const handleTitleBlur = () => {
    if (!moodboard || title === moodboard.title) return;
    onUpdateMoodboard(moodboard.id, { title: title.trim() || 'Moodboard' });
  };

  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    // Middle mouse is handled globally for pan
    if (e.button === 1) return;
    if (interactionMode !== 'cursor') return;
    if (e.button !== 0) return;

    // Drag empty space to pan the moodboard canvas
    if (e.target === e.currentTarget) {
      setSelectedId(null);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      panRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX: pan.x,
        origY: pan.y,
      };
      setIsPanning(true);
    }
  };

  const handleCanvasPointerMove = (e: React.PointerEvent) => {
    const panState = panRef.current;
    if (panState) {
      setPan({
        x: panState.origX + (e.clientX - panState.startX),
        y: panState.origY + (e.clientY - panState.startY),
      });
      return;
    }

    const interaction = interactionRef.current;
    const canvas = canvasRef.current;
    if (!interaction || !canvas) return;

    const rect = canvas.getBoundingClientRect();
    const patch = applyCardInteraction(interaction, e.clientX, e.clientY, rect);

    setPlacements((prev) =>
      prev.map((p) => (p.itemId === interaction.itemId ? { ...p, ...patch } : p))
    );
  };

  const handleCanvasPointerUp = () => {
    if (panRef.current) {
      panRef.current = null;
      setIsPanning(false);
      return;
    }
    if (!interactionRef.current) return;
    interactionRef.current = null;
    persistPlacements();
  };

  const handleCanvasPointerLeave = () => {
    // Pan uses pointer capture — don't abort when the cursor leaves the hit box
    if (panRef.current) return;
    handleCanvasPointerUp();
  };

  const itemAspect = (itemId: string) => {
    if (resolvedAspects[itemId] && resolvedAspects[itemId] > 0) {
      return resolvedAspects[itemId];
    }
    const item = allItems.find((i) => i.id === itemId);
    return item ? getItemAspectRatio(item) : 1;
  };

  const handleAspectResolved = (itemId: string, aspectRatio: number) => {
    setResolvedAspects((prev) => {
      if (prev[itemId] && Math.abs(prev[itemId] - aspectRatio) < 0.001) return prev;
      return { ...prev, [itemId]: aspectRatio };
    });

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const canvasAR = rect.width / Math.max(rect.height, 1);

    setPlacements((prev) =>
      prev.map((p) => {
        if (p.itemId !== itemId) return p;
        const height = heightFromWidth(p.width, aspectRatio, canvasAR);
        if (Math.abs((p.height ?? 0) - height) < 0.05) return p;
        return { ...p, height };
      })
    );
  };

  const startMove = (e: React.PointerEvent, placement: MoodboardPlacement) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    interactionRef.current = {
      type: 'move',
      itemId: placement.itemId,
      startX: e.clientX,
      startY: e.clientY,
      orig: { ...placement },
      aspectRatio: itemAspect(placement.itemId),
    };
  };

  const startResize = (
    e: React.PointerEvent,
    placement: MoodboardPlacement,
    handle: 'nw' | 'ne' | 'sw' | 'se'
  ) => {
    interactionRef.current = {
      type: 'resize',
      itemId: placement.itemId,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      orig: { ...placement },
      aspectRatio: itemAspect(placement.itemId),
    };
  };

  const startRotate = (e: React.PointerEvent, placement: MoodboardPlacement) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ar = itemAspect(placement.itemId);
    const center = getCardCenter(placement, rect, ar);
    const startAngle =
      (Math.atan2(e.clientY - center.y, e.clientX - center.x) * 180) / Math.PI;

    interactionRef.current = {
      type: 'rotate',
      itemId: placement.itemId,
      startX: e.clientX,
      startY: e.clientY,
      startAngle,
      origRotation: placement.rotation ?? 0,
      centerX: center.x,
      centerY: center.y,
    };
  };

  if (!moodboard) return null;

  const itemMap = new Map(allItems.map((i) => [i.id, i]));

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] bg-[#0a0a0b] overflow-hidden overscroll-none">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 flex flex-col overflow-hidden"
        >
          <header
            className={`shrink-0 z-10 flex items-center justify-between px-4 md:px-8 py-4 border-b border-white/10 bg-[#0a0a0b] transition-opacity duration-300 ${
              contentReady ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <LayoutGrid className="w-5 h-5 text-accent shrink-0" />
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleTitleBlur}
                className="bg-transparent border-none outline-none text-lg font-medium text-white truncate max-w-[min(60vw,400px)]"
              />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setNotesOpen((v) => !v)}
                className={`p-2.5 rounded-full transition-colors ${
                  notesOpen || additionalNotes
                    ? 'bg-accent/20 text-accent'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
                title="Notes supplémentaires"
              >
                <StickyNote className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  persistPlacements();
                  onClose();
                }}
                className="p-2.5 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
                title="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </header>

          <AnimatePresence>
            {notesOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="shrink-0 overflow-hidden border-b border-white/10 bg-[#0a0a0b]"
              >
                <div className="px-4 md:px-8 py-3">
                  <label className="block text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-2">
                    Notes supplémentaires
                  </label>
                  <textarea
                    value={additionalNotes}
                    onChange={(e) => setAdditionalNotes(e.target.value)}
                    placeholder="Contexte, rappels, liens utiles…"
                    rows={3}
                    className="w-full max-w-2xl px-3 py-2.5 text-xs leading-relaxed rounded-xl border border-white/10 bg-white/5 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-accent/40 resize-y min-h-[72px]"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={layerRef} className="relative flex-1 min-h-0 overflow-hidden flex flex-col">
            <AnimatePresence>
              {!contentReady && (
                <motion.div
                  key="moodboard-loading"
                  initial={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="absolute inset-0 z-[90] flex items-center justify-center bg-[#0a0a0b]"
                  role="status"
                  aria-label="Chargement du moodboard"
                >
                  <button
                    type="button"
                    onClick={onClose}
                    className="absolute top-4 right-4 md:top-5 md:right-8 p-2.5 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
                    title="Fermer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <CobeaLogoMark className="w-14 h-14 text-zinc-50 animate-spin" title="Chargement" />
                </motion.div>
              )}
            </AnimatePresence>

            <div
              className={`flex-1 min-h-0 flex flex-col transition-opacity duration-300 ${
                contentReady ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <DetailDrawingLayer
                itemId={moodboard.id}
                drawingData={moodboard.drawingData}
                onDrawingChange={onUpdateDrawing}
                onInitialReady={() => setDrawingReady(true)}
                toolboxAlwaysVisible
                drawModeActive={interactionMode === 'draw'}
                contentOffset={{ x: pan.x, y: pan.y, scale: zoom }}
                onSetDrawMode={(active) => {
                  setInteractionMode(active ? 'draw' : 'cursor');
                  if (!active) setSelectedId(null);
                }}
                className="flex-1 min-h-0 overflow-hidden moodboard-canvas-bg"
                style={{
                  backgroundPosition: `${pan.x}px ${pan.y}px`,
                  backgroundSize: `${DOT_GRID * zoom}px ${DOT_GRID * zoom}px`,
                }}
              >
                <div
                  ref={canvasRef}
                  className={`relative w-full h-full z-[5] ${
                    interactionMode === 'cursor'
                      ? isPanning
                        ? 'cursor-grabbing'
                        : 'cursor-grab'
                      : ''
                  }`}
                  onPointerDown={handleCanvasPointerDown}
                  onPointerMove={handleCanvasPointerMove}
                  onPointerUp={handleCanvasPointerUp}
                  onPointerCancel={handleCanvasPointerUp}
                  onPointerLeave={handleCanvasPointerLeave}
                >
                  {placements.map((placement) => {
                    const refItem = itemMap.get(placement.itemId);
                    if (!refItem) return null;

                    return (
                      <MoodboardCardFrame
                        key={placement.itemId}
                        placement={placement}
                        item={refItem}
                        isSelected={selectedId === placement.itemId}
                        interactive={interactionMode === 'cursor'}
                        onSelect={() => selectCard(placement.itemId)}
                        onMoveStart={(e) => startMove(e, placement)}
                        onResizeStart={(e, handle) => startResize(e, placement, handle)}
                        onRotateStart={(e) => startRotate(e, placement)}
                        onAspectRatioResolved={handleAspectResolved}
                        onCardUpdated={onCardUpdated}
                      />
                    );
                  })}

                  {placements.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center text-zinc-500 text-sm pointer-events-none">
                      Moodboard vide — glissez pour vous déplacer
                    </div>
                  )}
                </div>
              </DetailDrawingLayer>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
