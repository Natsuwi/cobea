import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import {
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Bold,
  Italic,
  Strikethrough,
  Code,
  SquareCode,
  List,
  ListOrdered,
  ListTodo,
  Link,
  Minus,
  type LucideIcon,
} from 'lucide-react';
import { SlashCommand } from '../lib/slashCommands';

const ICONS: Record<string, LucideIcon> = {
  h1: Heading1,
  h2: Heading2,
  h3: Heading3,
  quote: Quote,
  bold: Bold,
  italic: Italic,
  strike: Strikethrough,
  code: Code,
  codeblock: SquareCode,
  ul: List,
  ol: ListOrdered,
  todo: ListTodo,
  link: Link,
  hr: Minus,
};

interface SlashCommandMenuProps {
  commands: SlashCommand[];
  selectedIndex: number;
  onSelect: (command: SlashCommand) => void;
  onHover: (index: number) => void;
  position: { top: number; left: number };
  /** Lock parent from closing the menu while scrolling / tapping */
  onLockChange?: (locked: boolean) => void;
}

export const SlashCommandMenu: React.FC<SlashCommandMenuProps> = ({
  commands,
  selectedIndex,
  onSelect,
  onHover,
  position,
  onLockChange,
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const pointerStartY = useRef(0);
  const pointerMoved = useRef(false);
  const unlockTimer = useRef<number | null>(null);

  const lock = () => {
    if (unlockTimer.current != null) {
      window.clearTimeout(unlockTimer.current);
      unlockTimer.current = null;
    }
    onLockChange?.(true);
  };

  const unlockSoon = () => {
    if (unlockTimer.current != null) window.clearTimeout(unlockTimer.current);
    unlockTimer.current = window.setTimeout(() => {
      unlockTimer.current = null;
      onLockChange?.(false);
    }, 320);
  };

  useEffect(() => {
    return () => {
      if (unlockTimer.current != null) window.clearTimeout(unlockTimer.current);
      onLockChange?.(false);
    };
  }, [onLockChange]);

  useEffect(() => {
    // Only auto-scroll highlight for keyboard nav — skip if user is finger-scrolling
    if (pointerMoved.current) return;
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const menu = (
    <motion.div
      initial={{ opacity: 0, y: 4, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
      ref={listRef}
      className="fixed z-[200] w-[min(18rem,calc(100vw-1.5rem))] max-h-[min(16rem,42dvh)] overflow-y-auto overscroll-contain rounded-2xl bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/10 shadow-2xl py-1.5 no-scrollbar touch-pan-y"
      style={{ top: position.top, left: position.left, WebkitOverflowScrolling: 'touch' }}
      role="listbox"
      onPointerDownCapture={() => {
        lock();
      }}
      onPointerUpCapture={() => {
        unlockSoon();
      }}
      onPointerCancelCapture={() => {
        unlockSoon();
      }}
      onTouchStartCapture={() => {
        lock();
      }}
      onTouchEndCapture={() => {
        unlockSoon();
      }}
      onWheel={() => {
        lock();
        unlockSoon();
      }}
    >
      <p className="px-3 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
        Formatage
      </p>
      {commands.length === 0 ? (
        <p className="text-xs text-zinc-400 text-center py-3 px-3">Aucun résultat</p>
      ) : (
        commands.map((cmd, index) => {
          const Icon = ICONS[cmd.id] || Code;
          const active = index === selectedIndex;
          return (
            <button
              key={cmd.id}
              type="button"
              data-index={index}
              role="option"
              aria-selected={active}
              onMouseEnter={() => onHover(index)}
              onPointerDown={(e) => {
                // Don't preventDefault here — that blocks menu scrolling on mobile
                e.stopPropagation();
                pointerStartY.current = e.clientY;
                pointerMoved.current = false;
                lock();
              }}
              onPointerMove={(e) => {
                if (Math.abs(e.clientY - pointerStartY.current) > 10) {
                  pointerMoved.current = true;
                }
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
                if (!pointerMoved.current) {
                  e.preventDefault();
                  onSelect(cmd);
                }
                unlockSoon();
              }}
              onPointerCancel={() => {
                unlockSoon();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors touch-manipulation ${
                active
                  ? 'bg-zinc-100 dark:bg-zinc-800'
                  : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/60'
              }`}
            >
              <span
                className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center ${
                  active
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-medium text-zinc-900 dark:text-zinc-100">
                  {cmd.label}
                </span>
                <span className="block text-[11px] text-zinc-400 truncate">
                  {cmd.description}
                </span>
              </span>
            </button>
          );
        })
      )}
    </motion.div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(menu, document.body);
};
