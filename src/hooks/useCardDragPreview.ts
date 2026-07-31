import { useCallback, useEffect, useRef, useState } from 'react';

export const ITEM_DRAG_MIME = 'application/x-haven-item';

/** Drag ghost size relative to the source card */
export const CARD_DRAG_PREVIEW_SCALE = 0.58;

export interface CardDragPreviewState {
  x: number;
  y: number;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
  /** Degrees — positive when moving right */
  tilt: number;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Native DnD with a custom mini-card ghost that tilts left/right with movement.
 */
export function useCardDragPreview(options?: {
  onDragStartItem?: (id: string) => void;
  onDragEndItem?: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState<CardDragPreviewState | null>(null);
  const lastXRef = useRef(0);
  const tiltRef = useRef(0);
  const didDragRef = useRef(false);
  const onStartRef = useRef(options?.onDragStartItem);
  const onEndRef = useRef(options?.onDragEndItem);
  onStartRef.current = options?.onDragStartItem;
  onEndRef.current = options?.onDragEndItem;

  const handleDragStart = useCallback((e: React.DragEvent, itemId: string) => {
    const el = cardRef.current;
    if (!el) return;

    e.dataTransfer.clearData();
    e.dataTransfer.setData(ITEM_DRAG_MIME, itemId);
    e.dataTransfer.setData('text/plain', itemId);
    e.dataTransfer.effectAllowed = 'move';

    const blank = document.createElement('canvas');
    blank.width = 1;
    blank.height = 1;
    e.dataTransfer.setDragImage(blank, 0, 0);

    const rect = el.getBoundingClientRect();
    const scale = CARD_DRAG_PREVIEW_SCALE;
    lastXRef.current = e.clientX;
    tiltRef.current = 0;
    didDragRef.current = true;

    setPreview({
      x: e.clientX,
      y: e.clientY,
      width: rect.width * scale,
      height: rect.height * scale,
      offsetX: (e.clientX - rect.left) * scale,
      offsetY: (e.clientY - rect.top) * scale,
      tilt: 0,
    });

    onStartRef.current?.(itemId);
  }, []);

  useEffect(() => {
    if (!preview) return;

    const updateFromPoint = (clientX: number, clientY: number) => {
      if (clientX === 0 && clientY === 0) return;

      const dx = clientX - lastXRef.current;
      lastXRef.current = clientX;

      const target = clamp(dx * 2.8, -20, 20);
      tiltRef.current = tiltRef.current * 0.65 + target * 0.35;
      tiltRef.current *= 0.9;

      setPreview((prev) =>
        prev
          ? {
              ...prev,
              x: clientX,
              y: clientY,
              tilt: tiltRef.current,
            }
          : null
      );
    };

    const onDragOver = (e: DragEvent) => {
      updateFromPoint(e.clientX, e.clientY);
    };

    const onDrag = (e: DragEvent) => {
      updateFromPoint(e.clientX, e.clientY);
    };

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      setPreview(null);
      tiltRef.current = 0;
      onEndRef.current?.();
      window.setTimeout(() => {
        didDragRef.current = false;
      }, 80);
    };

    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drag', onDrag);
    window.addEventListener('dragend', cleanup);
    window.addEventListener('drop', cleanup);

    return () => {
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drag', onDrag);
      window.removeEventListener('dragend', cleanup);
      window.removeEventListener('drop', cleanup);
    };
  }, [!!preview]);

  const suppressClickIfDragged = useCallback((e: React.MouseEvent) => {
    if (didDragRef.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  return {
    cardRef,
    preview,
    isDragging: !!preview,
    handleDragStart,
    suppressClickIfDragged,
  };
}
