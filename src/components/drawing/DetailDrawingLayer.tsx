import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Pencil, Eye, EyeOff, Trash2, Undo2, Redo2 } from 'lucide-react';
import { ColorWheelPicker, COLOR_SLOT_COUNT } from './ColorWheelPicker';

const BRUSH_IMG = '/drawing_tool/Pinceau.png';
const ERASER_IMG = '/drawing_tool/Gomme.png';
const CURSOR_IMG = '/drawing_tool/Curseur.png';

const MIN_BRUSH_SIZE = 2;
const MAX_BRUSH_SIZE = 48;
const MAX_HISTORY = 40;

type DrawTool = 'brush' | 'eraser';

interface DetailDrawingLayerProps {
  itemId: string;
  drawingData?: string;
  onDrawingChange: (id: string, data: string | null) => void;
  children: React.ReactNode;
  className?: string;
  /** Show drawing toolbox permanently (moodboard view) */
  toolboxAlwaysVisible?: boolean;
  /** Draw mode on/off when toolboxAlwaysVisible — cursor mode when false */
  drawModeActive?: boolean;
  /** Set draw vs cursor mode (moodboard) */
  onSetDrawMode?: (active: boolean) => void;
  /** Pan/zoom for content + drawing canvas (moodboard navigation) */
  contentOffset?: { x: number; y: number; scale?: number };
  style?: React.CSSProperties;
}

export const DetailDrawingLayer: React.FC<DetailDrawingLayerProps> = ({
  itemId,
  drawingData,
  onDrawingChange,
  children,
  className = '',
  toolboxAlwaysVisible = false,
  drawModeActive = false,
  onSetDrawMode,
  contentOffset,
  style,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorBtnRef = useRef<HTMLButtonElement>(null);
  const sizeBtnRef = useRef<HTMLButtonElement>(null);
  const sizePanelRef = useRef<HTMLDivElement>(null);

  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [isDrawingVisible, setIsDrawingVisible] = useState(true);
  const [tool, setTool] = useState<DrawTool>('brush');
  const [brushSize, setBrushSize] = useState<number>(10);
  const [color, setColor] = useState('#f59e0b');
  const [colorSlots, setColorSlots] = useState<(string | null)[]>(() =>
    Array.from({ length: COLOR_SLOT_COUNT }, () => null)
  );
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showSizePicker, setShowSizePicker] = useState(false);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [hasDrawing, setHasDrawing] = useState(!!drawingData);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const lastMidRef = useRef<{ x: number; y: number } | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastExportedRef = useRef<string | null>(drawingData ?? null);
  const activeItemRef = useRef(itemId);
  const sizeRef = useRef({ width: 0, height: 0 });
  const undoStackRef = useRef<(string | null)[]>([]);
  const redoStackRef = useRef<(string | null)[]>([]);
  const brushSizeRef = useRef(brushSize);
  brushSizeRef.current = brushSize;
  const cursorPosRef = useRef(cursorPos);
  cursorPosRef.current = cursorPos;
  /** Ctrl + horizontal move → resize brush while freezing the drawing cursor */
  const brushResizeRef = useRef<{
    startX: number;
    startSize: number;
    frozenPos: { x: number; y: number };
  } | null>(null);

  const setupContext = useCallback((ctx: CanvasRenderingContext2D, dpr: number) => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
  }, []);

  const syncHistoryButtons = useCallback(() => {
    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(redoStackRef.current.length > 0);
  }, []);

  const resetHistory = useCallback(() => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    setCanUndo(false);
    setCanRedo(false);
  }, []);

  const captureSnapshot = useCallback((): string | null => {
    const canvas = canvasRef.current;
    if (!canvas || canvas.width === 0 || canvas.height === 0) return null;
    if (isCanvasEmpty(canvas)) return null;
    return canvas.toDataURL('image/png');
  }, []);

  const restoreSnapshot = useCallback(
    (data: string | null) => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;

      const { width, height } = container.getBoundingClientRect();
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      setupContext(ctx, dpr);
      ctx.clearRect(0, 0, width, height);

      if (!data) {
        lastExportedRef.current = null;
        setHasDrawing(false);
        onDrawingChange(itemId, null);
        return;
      }

      const img = new Image();
      if (data.startsWith('http://') || data.startsWith('https://')) {
        img.crossOrigin = 'anonymous';
      }
      img.onload = () => {
        if (activeItemRef.current !== itemId) return;
        const c = canvasRef.current;
        const cx = c?.getContext('2d');
        if (!cx || !c) return;
        setupContext(cx, dpr);
        cx.clearRect(0, 0, width, height);
        cx.drawImage(img, 0, 0, width, height);
        lastExportedRef.current = data;
        setHasDrawing(!isCanvasEmpty(c));
        onDrawingChange(itemId, data);
      };
      img.src = data;
    },
    [itemId, onDrawingChange, setupContext]
  );

  const pushUndoSnapshot = useCallback(() => {
    const snapshot = captureSnapshot();
    undoStackRef.current.push(snapshot);
    if (undoStackRef.current.length > MAX_HISTORY) {
      undoStackRef.current.shift();
    }
    redoStackRef.current = [];
    syncHistoryButtons();
  }, [captureSnapshot, syncHistoryButtons]);

  const handleUndo = useCallback(() => {
    if (undoStackRef.current.length === 0 || drawingRef.current) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const current = captureSnapshot();
    const previous = undoStackRef.current.pop()!;
    redoStackRef.current.push(current);
    restoreSnapshot(previous);
    syncHistoryButtons();
  }, [captureSnapshot, restoreSnapshot, syncHistoryButtons]);

  const handleRedo = useCallback(() => {
    if (redoStackRef.current.length === 0 || drawingRef.current) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const current = captureSnapshot();
    const next = redoStackRef.current.pop()!;
    undoStackRef.current.push(current);
    restoreSnapshot(next);
    syncHistoryButtons();
  }, [captureSnapshot, restoreSnapshot, syncHistoryButtons]);

  const paintImageOntoCanvas = useCallback(
    (data: string | null | undefined, width: number, height: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      setupContext(ctx, dpr);
      ctx.clearRect(0, 0, width, height);

      if (!data) {
        setHasDrawing(false);
        return;
      }

      const img = new Image();
      if (data.startsWith('http://') || data.startsWith('https://')) {
        img.crossOrigin = 'anonymous';
      }
      img.onload = () => {
        if (activeItemRef.current !== itemId) return;
        const c = canvasRef.current;
        const cx = c?.getContext('2d');
        if (!cx || !c) return;
        setupContext(cx, dpr);
        cx.clearRect(0, 0, width, height);
        cx.drawImage(img, 0, 0, width, height);
        setHasDrawing(!isCanvasEmpty(c));
      };
      img.src = data;
    },
    [itemId, setupContext]
  );

  const syncCanvasSize = useCallback(
    (preserve: boolean) => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;

      const { width, height } = container.getBoundingClientRect();
      if (width === 0 || height === 0) return;

      const prev = sizeRef.current;
      const sameSize =
        Math.abs(prev.width - width) < 0.5 && Math.abs(prev.height - height) < 0.5;
      if (sameSize && preserve) return;

      const dpr = window.devicePixelRatio || 1;
      let snapshot: string | null = null;

      if (preserve && canvas.width > 0 && canvas.height > 0) {
        snapshot = canvas.toDataURL();
      }

      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      sizeRef.current = { width, height };

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      setupContext(ctx, dpr);

      if (snapshot && snapshot !== 'data:,') {
        const img = new Image();
        if (snapshot.startsWith('http://') || snapshot.startsWith('https://')) {
          img.crossOrigin = 'anonymous';
        }
        img.onload = () => {
          if (activeItemRef.current !== itemId) return;
          const c = canvasRef.current;
          const cx = c?.getContext('2d');
          if (!cx) return;
          setupContext(cx, dpr);
          cx.clearRect(0, 0, width, height);
          cx.drawImage(img, 0, 0, width, height);
        };
        img.src = snapshot;
      } else if (!preserve) {
        paintImageOntoCanvas(lastExportedRef.current, width, height);
      }
    },
    [itemId, paintImageOntoCanvas, setupContext]
  );

  // Init / switch item — load drawing once, never reload on save echo
  useEffect(() => {
    activeItemRef.current = itemId;
    lastExportedRef.current = drawingData ?? null;
    setHasDrawing(!!drawingData);
    setIsDrawingMode(false);
    setShowColorPicker(false);
    setShowSizePicker(false);
    setIsDrawingVisible(true);
    setCursorPos(null);
    sizeRef.current = { width: 0, height: 0 };
    resetHistory();

    const frame = requestAnimationFrame(() => {
      syncCanvasSize(false);
    });
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-init when card changes, not on save
  }, [itemId]);

  // Resize observer — preserve strokes, never reload from props
  useEffect(() => {
    const ro = new ResizeObserver(() => {
      if (drawingRef.current) return;
      syncCanvasSize(true);
    });
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [syncCanvasSize]);

  useEffect(() => {
    if (toolboxAlwaysVisible) {
      setIsDrawingMode(drawModeActive);
      if (!drawModeActive) {
        setShowColorPicker(false);
        setShowSizePicker(false);
        setCursorPos(null);
      }
    }
  }, [toolboxAlwaysVisible, drawModeActive, itemId]);

  useEffect(() => {
    if (!isDrawingMode && !toolboxAlwaysVisible) setCursorPos(null);
  }, [isDrawingMode, toolboxAlwaysVisible]);

  useEffect(() => {
    if (!showSizePicker) return;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (sizePanelRef.current?.contains(target)) return;
      if (sizeBtnRef.current?.contains(target)) return;
      setShowSizePicker(false);
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [showSizePicker]);

  useEffect(() => {
    const toolboxOpen = toolboxAlwaysVisible || isDrawingMode;
    if (!toolboxOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;

      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toolboxAlwaysVisible, drawModeActive, isDrawingMode, handleUndo, handleRedo]);

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas || activeItemRef.current !== itemId) return;

      if (isCanvasEmpty(canvas)) {
        if (lastExportedRef.current !== null) {
          lastExportedRef.current = null;
          setHasDrawing(false);
          onDrawingChange(itemId, null);
        }
        return;
      }

      const data = canvas.toDataURL('image/png');
      if (data === lastExportedRef.current) return;

      lastExportedRef.current = data;
      setHasDrawing(true);
      onDrawingChange(itemId, data);
    }, 500);
  }, [itemId, onDrawingChange]);

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement> | PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    // Normalize against layout size so drawing stays correct when CSS-zoomed
    const w = canvas.clientWidth || rect.width;
    const h = canvas.clientHeight || rect.height;
    return {
      x: ((e.clientX - rect.left) / Math.max(rect.width, 1)) * w,
      y: ((e.clientY - rect.top) / Math.max(rect.height, 1)) * h,
    };
  };

  const applyBrushStyle = (ctx: CanvasRenderingContext2D) => {
    ctx.lineWidth = brushSize;
    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.fillStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
    }
  };

  const drawSmoothSegment = (
    from: { x: number; y: number },
    control: { x: number; y: number },
    to: { x: number; y: number }
  ) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    applyBrushStyle(ctx);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.quadraticCurveTo(control.x, control.y, to.x, to.y);
    ctx.stroke();
  };

  const drawStraightSegment = (
    from: { x: number; y: number },
    to: { x: number; y: number }
  ) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    applyBrushStyle(ctx);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  };

  const canvasVisible = toolboxAlwaysVisible
    ? drawModeActive || hasDrawing
    : isDrawingVisible && (isDrawingMode || hasDrawing);
  const showToolbox = toolboxAlwaysVisible ? true : isDrawingMode;
  const canDraw = toolboxAlwaysVisible ? drawModeActive : isDrawingMode;

  // Ctrl + move horizontally to resize brush; drawing cursor stays frozen
  useEffect(() => {
    if (!canDraw) {
      brushResizeRef.current = null;
      return;
    }

    const endResize = () => {
      brushResizeRef.current = null;
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Meta') endResize();
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!(e.ctrlKey || e.metaKey)) {
        if (brushResizeRef.current) endResize();
        return;
      }

      const pos = cursorPosRef.current;
      if (!brushResizeRef.current) {
        if (!pos) return;
        brushResizeRef.current = {
          startX: e.clientX,
          startSize: brushSizeRef.current,
          frozenPos: { ...pos },
        };
        return;
      }

      const resize = brushResizeRef.current;
      const delta = e.clientX - resize.startX;
      const next = Math.round(
        Math.min(MAX_BRUSH_SIZE, Math.max(MIN_BRUSH_SIZE, resize.startSize + delta * 0.12))
      );
      if (next !== brushSizeRef.current) setBrushSize(next);
      setCursorPos(resize.frozenPos);
    };

    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', endResize);
    window.addEventListener('pointermove', onPointerMove, true);
    return () => {
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', endResize);
      window.removeEventListener('pointermove', onPointerMove, true);
      endResize();
    };
  }, [canDraw]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canDraw) return;
    // Left button only — middle click is reserved for canvas pan
    if (e.button !== 0) {
      e.preventDefault();
      return;
    }
    // Ctrl held = brush resize mode, never draw
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    pushUndoSnapshot();
    drawingRef.current = true;
    const pt = getPoint(e);
    lastPointRef.current = pt;
    lastMidRef.current = pt;

    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    applyBrushStyle(ctx);
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, brushSize / 2, 0, Math.PI * 2);
    ctx.fill();
    setHasDrawing(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // Brush resize handled globally while Ctrl is held — keep cursor frozen
    if (e.ctrlKey || e.metaKey || brushResizeRef.current) {
      return;
    }

    const pt = getPoint(e);
    setCursorPos(pt);

    if (!drawingRef.current || !lastPointRef.current || !lastMidRef.current) return;

    const mid = {
      x: (lastPointRef.current.x + pt.x) / 2,
      y: (lastPointRef.current.y + pt.y) / 2,
    };

    drawSmoothSegment(lastMidRef.current, lastPointRef.current, mid);

    lastPointRef.current = pt;
    lastMidRef.current = mid;
  };

  const handlePointerEnter = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setCursorPos(getPoint(e));
  };

  const handlePointerLeaveCanvas = () => {
    setCursorPos(null);
    handlePointerUp();
  };

  const handlePointerUp = () => {
    if (!drawingRef.current) return;

    if (lastMidRef.current && lastPointRef.current) {
      drawStraightSegment(lastMidRef.current, lastPointRef.current);
    }

    drawingRef.current = false;
    lastPointRef.current = null;
    lastMidRef.current = null;
    scheduleSave();
  };

  const handleColorChange = (c: string) => {
    setColor(c);
    if (tool === 'eraser') setTool('brush');
    if (toolboxAlwaysVisible) onSetDrawMode?.(true);
  };

  const handleSaveColorSlot = (index: number) => {
    setColorSlots((prev) => {
      const next = [...prev];
      next[index] = color;
      return next;
    });
  };

  const handleClearDrawing = () => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas || !hasDrawing) return;

    pushUndoSnapshot();

    const { width, height } = container.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    setupContext(ctx, dpr);
    ctx.clearRect(0, 0, width, height);
    lastExportedRef.current = null;
    setHasDrawing(false);
    onDrawingChange(itemId, null);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`} style={style}>
      <div
        className="absolute inset-0 origin-top-left"
        style={
          contentOffset
            ? {
                transform: `translate(${contentOffset.x}px, ${contentOffset.y}px) scale(${contentOffset.scale ?? 1})`,
              }
            : undefined
        }
      >
        {children}

        <canvas
          ref={canvasRef}
          className={`absolute inset-0 z-10 touch-none ${
            canvasVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
          } ${canDraw ? 'cursor-none' : 'pointer-events-none'}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerEnter={handlePointerEnter}
          onPointerLeave={handlePointerLeaveCanvas}
        />

        {canDraw && cursorPos && (
          <div
            className="pointer-events-none absolute z-[15] rounded-full border-2 box-border"
            style={{
              left: cursorPos.x,
              top: cursorPos.y,
              width: brushSize,
              height: brushSize,
              transform: 'translate(-50%, -50%)',
              borderColor: tool === 'eraser' ? 'rgba(255,255,255,0.85)' : color,
              backgroundColor:
                tool === 'eraser' ? 'rgba(255,255,255,0.25)' : `${color}40`,
              boxShadow: '0 0 0 1px rgba(0,0,0,0.25)',
            }}
          />
        )}
      </div>

      {!toolboxAlwaysVisible && (
        <button
          type="button"
          onClick={() => setIsDrawingMode((v) => !v)}
          className={`absolute bottom-4 left-4 z-20 w-11 h-11 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 ${
            isDrawingMode
              ? 'bg-amber-500 text-white scale-105'
              : 'bg-white/90 dark:bg-zinc-800/90 text-zinc-700 dark:text-zinc-200 hover:scale-105 border border-black/5 dark:border-white/10 backdrop-blur-md'
          }`}
          title={isDrawingMode ? 'Quitter le mode dessin' : 'Dessiner sur la carte'}
        >
          <Pencil className="w-[18px] h-[18px] stroke-[2]" />
        </button>
      )}

      <AnimatePresence>
        {showToolbox && (
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="absolute bottom-0 inset-x-0 z-[70] flex items-end justify-center pointer-events-none"
            data-drawing-chrome
          >
            <div className="pointer-events-auto flex items-end gap-4 px-4 pb-1">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="relative">
                  <button
                    ref={sizeBtnRef}
                    type="button"
                    onClick={() => {
                      setShowSizePicker((v) => !v);
                      setShowColorPicker(false);
                    }}
                    className="w-10 h-10 rounded-full bg-white dark:bg-zinc-800 border border-black/10 dark:border-white/10 shadow-md flex items-center justify-center hover:scale-105 transition-transform"
                    title="Taille du pinceau"
                  >
                    <span
                      className="rounded-full bg-zinc-800 dark:bg-zinc-200"
                      style={{
                        width: Math.max(4, Math.min(brushSize * 0.45, 18)),
                        height: Math.max(4, Math.min(brushSize * 0.45, 18)),
                      }}
                    />
                  </button>
                  <AnimatePresence>
                    {showSizePicker && (
                      <motion.div
                        ref={sizePanelRef}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6 }}
                        className="absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 p-3 rounded-2xl bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/10 shadow-xl"
                      >
                        <span className="text-[10px] font-medium tabular-nums text-zinc-500 dark:text-zinc-400">
                          {brushSize}
                        </span>
                        <div className="flex items-center justify-center h-[120px]">
                          <input
                            type="range"
                            min={MIN_BRUSH_SIZE}
                            max={MAX_BRUSH_SIZE}
                            value={brushSize}
                            onChange={(e) => setBrushSize(Number(e.target.value))}
                            className="brush-size-gauge"
                            aria-label="Taille du pinceau"
                          />
                        </div>
                        <span
                          className="rounded-full bg-zinc-800 dark:bg-zinc-200"
                          style={{
                            width: Math.min(brushSize, 22),
                            height: Math.min(brushSize, 22),
                          }}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="relative">
                  <button
                    ref={colorBtnRef}
                    type="button"
                    onClick={() => {
                      setShowColorPicker((v) => !v);
                      setShowSizePicker(false);
                    }}
                    className="w-10 h-10 rounded-full border-2 border-white dark:border-zinc-700 shadow-md hover:scale-105 transition-transform ring-1 ring-black/10"
                    style={{ backgroundColor: color }}
                    title="Couleur"
                  />
                  <AnimatePresence>
                    {showColorPicker && (
                      <ColorWheelPicker
                        isOpen={showColorPicker}
                        color={color}
                        slots={colorSlots}
                        onChange={handleColorChange}
                        onSaveSlot={handleSaveColorSlot}
                        onClose={() => setShowColorPicker(false)}
                        anchorRef={colorBtnRef}
                      />
                    )}
                  </AnimatePresence>
                </div>

                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={!canUndo}
                  className="w-10 h-10 rounded-full bg-white dark:bg-zinc-800 border border-black/10 dark:border-white/10 shadow-md flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-35 disabled:hover:scale-100 disabled:cursor-not-allowed"
                  title="Annuler (Ctrl+Z)"
                >
                  <Undo2 className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
                </button>

                <button
                  type="button"
                  onClick={handleRedo}
                  disabled={!canRedo}
                  className="w-10 h-10 rounded-full bg-white dark:bg-zinc-800 border border-black/10 dark:border-white/10 shadow-md flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-35 disabled:hover:scale-100 disabled:cursor-not-allowed"
                  title="Rétablir (Ctrl+Y)"
                >
                  <Redo2 className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
                </button>

                {!toolboxAlwaysVisible && (
                  <button
                    type="button"
                    onClick={() => setIsDrawingVisible((v) => !v)}
                    className="w-10 h-10 rounded-full bg-white dark:bg-zinc-800 border border-black/10 dark:border-white/10 shadow-md flex items-center justify-center hover:scale-105 transition-transform"
                    title={isDrawingVisible ? 'Masquer le dessin' : 'Afficher le dessin'}
                  >
                    {isDrawingVisible ? (
                      <Eye className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-zinc-400" />
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleClearDrawing}
                  className="w-10 h-10 rounded-full bg-white dark:bg-zinc-800 border border-rose-200 dark:border-rose-900/50 shadow-md flex items-center justify-center hover:scale-105 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all text-rose-500"
                  title="Effacer tout le dessin"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="drawing-tool-tray">
                {(
                  toolboxAlwaysVisible
                    ? ([
                        { id: 'brush' as const, img: BRUSH_IMG, label: 'Pinceau' },
                        { id: 'eraser' as const, img: ERASER_IMG, label: 'Gomme' },
                        { id: 'cursor' as const, img: CURSOR_IMG, label: 'Curseur' },
                      ] as const)
                    : ([
                        { id: 'brush' as const, img: BRUSH_IMG, label: 'Pinceau' },
                        { id: 'eraser' as const, img: ERASER_IMG, label: 'Gomme' },
                      ] as const)
                ).map((t) => {
                  const selected =
                    t.id === 'cursor'
                      ? !drawModeActive
                      : drawModeActive || !toolboxAlwaysVisible
                        ? tool === t.id
                        : false;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        if (t.id === 'cursor') {
                          onSetDrawMode?.(false);
                          setCursorPos(null);
                          return;
                        }
                        setTool(t.id);
                        if (toolboxAlwaysVisible) {
                          onSetDrawMode?.(true);
                        } else {
                          setIsDrawingMode(true);
                        }
                      }}
                      title={t.label}
                      className={`drawing-tool-slot drawing-tool-slot--${t.id}${selected ? ' drawing-tool-slot--active' : ''}`}
                    >
                      <img src={t.img} alt={t.label} draggable={false} />
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

function isCanvasEmpty(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext('2d');
  if (!ctx) return true;
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] !== 0) return false;
  }
  return true;
}
