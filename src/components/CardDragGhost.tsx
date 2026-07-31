import React from 'react';
import { createPortal } from 'react-dom';
import type { CardDragPreviewState } from '../hooks/useCardDragPreview';

interface CardDragGhostProps {
  preview: CardDragPreviewState;
  children: React.ReactNode;
  className?: string;
}

/** Floating mini-card ghost that follows the cursor with a left/right tilt. */
export const CardDragGhost: React.FC<CardDragGhostProps> = ({
  preview,
  children,
  className = '',
}) => {
  return createPortal(
    <div
      aria-hidden
      className={`fixed z-[9999] pointer-events-none will-change-transform ${className}`}
      style={{
        left: preview.x - preview.offsetX,
        top: preview.y - preview.offsetY,
        width: preview.width,
        height: preview.height,
        transform: `
          perspective(900px)
          rotateY(${-preview.tilt * 1.35}deg)
          rotateZ(${preview.tilt * 0.45}deg)
        `,
        transformOrigin: 'center center',
        transition: 'transform 40ms linear',
        filter: 'drop-shadow(0 18px 28px rgba(0,0,0,0.32))',
      }}
    >
      <div className="w-full h-full overflow-hidden rounded-2xl md:rounded-[1.25rem] ring-1 ring-black/10 dark:ring-white/10 bg-white dark:bg-zinc-900">
        {children}
      </div>
    </div>,
    document.body
  );
};
