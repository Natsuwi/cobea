import React from 'react';
import { isUnknownKind, normalizeKind } from '../lib/cardKinds';

interface CardKindBadgeProps {
  kind?: string | null;
  className?: string;
}

/** Visible badge for MyMind kinds not yet handled in the UI. */
export const CardKindBadge: React.FC<CardKindBadgeProps> = ({ kind, className = '' }) => {
  if (!isUnknownKind(kind)) return null;
  const label = normalizeKind(kind);
  return (
    <span
      className={`inline-flex items-center max-w-[min(100%,14rem)] px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide bg-amber-500/90 text-amber-950 shadow-sm border border-amber-400/40 truncate ${className}`}
      title={`Type inconnu : ${label}`}
    >
      Type inconnu · {label}
    </span>
  );
};
