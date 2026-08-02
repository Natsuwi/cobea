import React, { useState } from 'react';
import { ImageItem, MoodboardPlacement, isNoteItem } from '../types';
import { MarkdownPreview } from './MarkdownPreview';
import { FileCardPreview, isDisplayableImageItem } from './FileCardPreview';

const MIN_SIZE = 6;
/** Max side of a new moodboard card, as % of the canvas axis it maps to. */
export const MOODBOARD_CARD_BASE = 22;

type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se';

export function getItemAspectRatio(item: ImageItem): number {
  if (item.aspectRatio && item.aspectRatio > 0) return item.aspectRatio;
  if (item.width && item.height && item.height > 0) return item.width / item.height;
  if (isNoteItem(item)) return 1;
  if (!isDisplayableImageItem(item)) return 0.85;
  return 1.2;
}

/** Visual aspect ratio (width / height) → placement % that match on a given canvas. */
export function placementSizeFromAspect(
  aspectRatio: number,
  canvasAspectRatio: number,
  baseMax = MOODBOARD_CARD_BASE
): { width: number; height: number } {
  const ar = aspectRatio > 0 ? aspectRatio : 1;
  const canvasAR = canvasAspectRatio > 0 ? canvasAspectRatio : 1.5;
  // width% / height% = visualAR / canvasAR
  const percentAR = ar / canvasAR;

  if (percentAR >= 1) {
    const width = baseMax;
    return { width, height: width / percentAR };
  }
  const height = baseMax;
  return { width: height * percentAR, height };
}

export function heightFromWidth(
  widthPercent: number,
  aspectRatio: number,
  canvasAspectRatio: number
): number {
  const ar = aspectRatio > 0 ? aspectRatio : 1;
  const canvasAR = canvasAspectRatio > 0 ? canvasAspectRatio : 1.5;
  return widthPercent * (canvasAR / ar);
}

export function widthFromHeight(
  heightPercent: number,
  aspectRatio: number,
  canvasAspectRatio: number
): number {
  const ar = aspectRatio > 0 ? aspectRatio : 1;
  const canvasAR = canvasAspectRatio > 0 ? canvasAspectRatio : 1.5;
  return heightPercent * (ar / canvasAR);
}

interface MoodboardCardFrameProps {
  placement: MoodboardPlacement;
  item: ImageItem;
  isSelected: boolean;
  interactive: boolean;
  onSelect: () => void;
  onMoveStart: (e: React.PointerEvent) => void;
  onResizeStart: (e: React.PointerEvent, handle: ResizeHandle) => void;
  onRotateStart: (e: React.PointerEvent) => void;
  onAspectRatioResolved?: (itemId: string, aspectRatio: number) => void;
}

export function MoodboardCardFrame({
  placement,
  item,
  isSelected,
  interactive,
  onSelect,
  onMoveStart,
  onResizeStart,
  onRotateStart,
  onAspectRatioResolved,
}: MoodboardCardFrameProps) {
  const rotation = placement.rotation ?? 0;
  const fallbackAR = getItemAspectRatio(item);
  const [naturalAR, setNaturalAR] = useState<number | null>(null);
  const aspectRatio = naturalAR ?? fallbackAR;
  const isNote = isNoteItem(item);
  const showAsFile = !isNote && !isDisplayableImageItem(item);
  const fixedAspect = isNote || showAsFile;

  return (
    <div
      className={`absolute touch-none ${interactive ? '' : 'pointer-events-none'}`}
      style={{
        left: `${placement.x}%`,
        top: `${placement.y}%`,
        width: `${placement.width}%`,
        height: fixedAspect ? undefined : 'auto',
        aspectRatio: fixedAspect ? String(aspectRatio) : undefined,
        transform: `rotate(${rotation}deg)`,
        transformOrigin: 'center center',
        zIndex: isSelected ? 999 : (placement.zIndex ?? 1),
      }}
      onPointerDown={(e) => {
        if (!interactive) return;
        if (e.button !== 0) return;
        onSelect();
        onMoveStart(e);
      }}
    >
      <div
        className={`relative w-full overflow-hidden rounded-xl shadow-2xl border ${
          fixedAspect ? 'h-full' : ''
        } ${
          isSelected
            ? 'border-amber-400 ring-2 ring-amber-400/40'
            : 'border-white/10'
        } ${interactive ? 'cursor-grab active:cursor-grabbing' : ''}`}
      >
        {isNote ? (
          <div className="w-full h-full p-3 bg-white dark:bg-zinc-900 overflow-hidden text-xs pointer-events-none">
            <p className="font-medium text-zinc-800 dark:text-zinc-100 mb-1 truncate">
              {item.title}
            </p>
            <MarkdownPreview content={item.markdown || ''} />
          </div>
        ) : showAsFile ? (
          <div className="w-full h-full pointer-events-none">
            <FileCardPreview
              title={item.title}
              mimeType={item.mimeType}
              filename={item.filename}
              size="sm"
            />
          </div>
        ) : (
          <img
            src={item.url}
            alt={item.title}
            className="block w-full h-auto pointer-events-none select-none"
            draggable={false}
            onLoad={(e) => {
              const img = e.currentTarget;
              if (!img.naturalWidth || !img.naturalHeight) return;
              const ar = img.naturalWidth / img.naturalHeight;
              setNaturalAR(ar);
              onAspectRatioResolved?.(item.id, ar);
            }}
          />
        )}
      </div>

      {isSelected && interactive && (
        <>
          {(['nw', 'ne', 'sw', 'se'] as const).map((handle) => (
            <button
              key={handle}
              type="button"
              className={`moodboard-handle moodboard-handle--${handle}`}
              onPointerDown={(e) => {
                e.stopPropagation();
                e.currentTarget.setPointerCapture(e.pointerId);
                onResizeStart(e, handle);
              }}
              aria-label={`Redimensionner ${handle}`}
            />
          ))}

          <div className="moodboard-rotate-stem" aria-hidden />

          <button
            type="button"
            className="moodboard-handle moodboard-handle--rotate"
            onPointerDown={(e) => {
              e.stopPropagation();
              e.currentTarget.setPointerCapture(e.pointerId);
              onRotateStart(e);
            }}
            aria-label="Pivoter"
          />
        </>
      )}
    </div>
  );
}

export type CardInteraction =
  | {
      type: 'move';
      itemId: string;
      startX: number;
      startY: number;
      orig: MoodboardPlacement;
      aspectRatio: number;
    }
  | {
      type: 'resize';
      itemId: string;
      handle: ResizeHandle;
      startX: number;
      startY: number;
      orig: MoodboardPlacement;
      aspectRatio: number;
    }
  | {
      type: 'rotate';
      itemId: string;
      startX: number;
      startY: number;
      startAngle: number;
      origRotation: number;
      centerX: number;
      centerY: number;
    };

export function applyCardInteraction(
  interaction: CardInteraction,
  clientX: number,
  clientY: number,
  canvasRect: DOMRect
): Partial<MoodboardPlacement> {
  const dx = ((clientX - interaction.startX) / canvasRect.width) * 100;
  const dy = ((clientY - interaction.startY) / canvasRect.height) * 100;
  const canvasAR = canvasRect.width / Math.max(canvasRect.height, 1);

  if (interaction.type === 'move') {
    const { orig, aspectRatio } = interaction;
    const height = heightFromWidth(orig.width, aspectRatio, canvasAR);
    return {
      x: Math.max(0, Math.min(100 - orig.width, orig.x + dx)),
      y: Math.max(0, Math.min(100 - height, orig.y + dy)),
      height,
    };
  }

  if (interaction.type === 'rotate') {
    const angle =
      (Math.atan2(clientY - interaction.centerY, clientX - interaction.centerX) * 180) /
      Math.PI;
    return {
      rotation: interaction.origRotation + (angle - interaction.startAngle),
    };
  }

  const { orig, handle, aspectRatio } = interaction;
  let width = orig.width;
  let height = heightFromWidth(orig.width, aspectRatio, canvasAR);
  let x = orig.x;
  let y = orig.y;

  // Lock visual aspect: size from the dominant drag axis, then derive the other.
  const widthFromDx =
    handle === 'se' || handle === 'ne'
      ? Math.max(MIN_SIZE, orig.width + dx)
      : Math.max(MIN_SIZE, orig.width - dx);
  const heightFromDy =
    handle === 'se' || handle === 'sw'
      ? Math.max(MIN_SIZE, height + dy)
      : Math.max(MIN_SIZE, height - dy);

  const candidateFromWidth = widthFromDx;
  const candidateFromHeight = widthFromHeight(heightFromDy, aspectRatio, canvasAR);
  width =
    Math.abs(widthFromDx - orig.width) >= Math.abs(candidateFromHeight - orig.width)
      ? candidateFromWidth
      : candidateFromHeight;
  height = heightFromWidth(width, aspectRatio, canvasAR);

  switch (handle) {
    case 'se':
      break;
    case 'sw':
      x = orig.x + orig.width - width;
      break;
    case 'ne':
      y = orig.y + heightFromWidth(orig.width, aspectRatio, canvasAR) - height;
      break;
    case 'nw':
      x = orig.x + orig.width - width;
      y = orig.y + heightFromWidth(orig.width, aspectRatio, canvasAR) - height;
      break;
  }

  width = Math.min(width, 100 - Math.max(0, x));
  height = heightFromWidth(width, aspectRatio, canvasAR);
  x = Math.max(0, Math.min(100 - width, x));
  y = Math.max(0, Math.min(100 - height, y));

  return { x, y, width, height };
}

export function getCardCenter(
  placement: MoodboardPlacement,
  canvasRect: DOMRect,
  aspectRatio = 1
): { x: number; y: number } {
  const canvasAR = canvasRect.width / Math.max(canvasRect.height, 1);
  const height = heightFromWidth(placement.width, aspectRatio, canvasAR);
  const cx = placement.x + placement.width / 2;
  const cy = placement.y + height / 2;
  return {
    x: canvasRect.left + (cx / 100) * canvasRect.width,
    y: canvasRect.top + (cy / 100) * canvasRect.height,
  };
}
