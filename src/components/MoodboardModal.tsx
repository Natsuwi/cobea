import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, LayoutGrid } from 'lucide-react';
import { ImageItem, MoodboardPlacement } from '../types';
import { DetailDrawingLayer } from './drawing/DetailDrawingLayer';
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
    data: { title?: string; moodboardPlacements?: MoodboardPlacement[] }
  ) => void;
  onUpdateDrawing: (id: string, data: string | null) => void;
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

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export const MoodboardModal: React.FC<MoodboardModalProps> = ({
  moodboard,
  allItems,
  onClose,
  onUpdateMoodboard,
  onUpdateDrawing,
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState('');
  const [placements, setPlacements] = useState<MoodboardPlacement[]>([]);
  const [interactionMode, setInteractionMode] = useState<MoodboardInteractionMode>('cursor');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [resolvedAspects, setResolvedAspects] = useState<Record<string, number>>({});
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const interactionRef = useRef<CardInteraction | null>(null);
  const panRef = useRef<PanState | null>(null);
  const panOffsetRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  panOffsetRef.current = pan;
  zoomRef.current = zoom;

  useEffect(() => {
    if (!moodboard) return;
    setTitle(moodboard.title || 'Moodboard');
    setPlacements(moodboard.moodboardPlacements || []);
    setInteractionMode('cursor');
    setSelectedId(null);
    setResolvedAspects({});
    setPan({ x: 0, y: 0 });
    setZoom(1);
    panRef.current = null;
    setIsPanning(false);
  }, [moodboard?.id]);

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
          <header className="shrink-0 z-10 flex items-center justify-between px-4 md:px-8 py-4 border-b border-white/10 bg-[#0a0a0b]">
            <div className="flex items-center gap-3 min-w-0">
              <LayoutGrid className="w-5 h-5 text-amber-400 shrink-0" />
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleTitleBlur}
                className="bg-transparent border-none outline-none text-lg font-medium text-white truncate max-w-[min(60vw,400px)]"
              />
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2.5 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
              title="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </header>

          <div ref={layerRef} className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <DetailDrawingLayer
            itemId={moodboard.id}
            drawingData={moodboard.drawingData}
            onDrawingChange={onUpdateDrawing}
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
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
