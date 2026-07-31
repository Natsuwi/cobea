import React, { useEffect, useRef } from 'react';
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
  link: Link,
  hr: Minus,
};

interface SlashCommandMenuProps {
  commands: SlashCommand[];
  selectedIndex: number;
  onSelect: (command: SlashCommand) => void;
  onHover: (index: number) => void;
  position: { top: number; left: number };
}

export const SlashCommandMenu: React.FC<SlashCommandMenuProps> = ({
  commands,
  selectedIndex,
  onSelect,
  onHover,
  position,
}) => {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (commands.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed z-[60] w-64 rounded-2xl bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/10 shadow-2xl p-3"
        style={{ top: position.top, left: position.left }}
      >
        <p className="text-xs text-zinc-400 text-center py-2">Aucun résultat</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 4, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
      ref={listRef}
      className="fixed z-[60] w-72 max-h-64 overflow-y-auto rounded-2xl bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/10 shadow-2xl py-1.5 no-scrollbar"
      style={{ top: position.top, left: position.left }}
      role="listbox"
    >
      <p className="px-3 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
        Formatage
      </p>
      {commands.map((cmd, index) => {
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
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(cmd);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
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
      })}
    </motion.div>
  );
};
