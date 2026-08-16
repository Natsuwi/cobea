import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEditor, EditorContent, Editor, ReactNodeViewRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Markdown } from '@tiptap/markdown';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { SlashCommandMenu } from './SlashCommandMenu';
import { TaskItemView } from './TaskItemView';
import { filterSlashCommands, SlashCommand } from '../lib/slashCommands';

interface NoteEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  minRows?: number;
  /** Immersive shell without border / helper text */
  variant?: 'default' | 'fullscreen' | 'embedded';
}

interface SlashState {
  open: boolean;
  query: string;
  from: number;
  to: number;
  selectedIndex: number;
  position: { top: number; left: number };
}

const INITIAL_SLASH: SlashState = {
  open: false,
  query: '',
  from: -1,
  to: -1,
  selectedIndex: 0,
  position: { top: 0, left: 0 },
};

function getMarkdown(editor: Editor): string {
  if (typeof editor.getMarkdown === 'function') {
    return editor.getMarkdown();
  }
  const storage = editor.storage as { markdown?: { getMarkdown?: () => string } };
  return storage.markdown?.getMarkdown?.() ?? editor.getText();
}

function getSuggestionCoords(editor: Editor): { top: number; left: number } {
  const { view } = editor;
  const { from } = view.state.selection;
  const coords = view.coordsAtPos(from);
  const vv = window.visualViewport;
  const viewH = vv?.height ?? window.innerHeight;
  const viewW = vv?.width ?? window.innerWidth;
  const offsetTop = vv?.offsetTop ?? 0;
  const offsetLeft = vv?.offsetLeft ?? 0;

  const menuH = Math.min(256, viewH * 0.42);
  const menuW = Math.min(288, viewW - 24);
  const gap = 8;

  let top = coords.bottom + gap;
  const spaceBelow = offsetTop + viewH - coords.bottom;
  if (spaceBelow < menuH + 16) {
    top = coords.top - menuH - gap;
  }
  top = Math.max(offsetTop + 8, Math.min(top, offsetTop + viewH - menuH - 8));

  let left = coords.left;
  left = Math.max(offsetLeft + 12, Math.min(left, offsetLeft + viewW - menuW - 12));

  return { top, left };
}

/** Detect `/query` before the cursor (line start or after whitespace). */
function detectSlash(editor: Editor): { query: string; from: number; to: number } | null {
  const { from } = editor.state.selection;
  const $from = editor.state.selection.$from;
  const textBefore = $from.parent.textBetween(
    Math.max(0, $from.parentOffset - 40),
    $from.parentOffset,
    undefined,
    '\ufffc'
  );

  const match = textBefore.match(/(?:^|\s)\/([^\s/]*)$/);
  if (!match) return null;

  const query = match[1];
  const slashStart = from - query.length - 1;
  return { query, from: slashStart, to: from };
}

export const NoteEditor: React.FC<NoteEditorProps> = ({
  value,
  onChange,
  placeholder = 'Écrivez… # titre, **gras**, > citation — ou tapez /',
  autoFocus = false,
  minRows = 8,
  variant = 'default',
}) => {
  const [slash, setSlash] = useState<SlashState>(INITIAL_SLASH);
  const slashRef = useRef(slash);
  slashRef.current = slash;
  /** While true, don't auto-close slash menu (mobile scroll / tap on menu) */
  const slashLockRef = useRef(false);

  const skipNextSync = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editorRef = useRef<Editor | null>(null);

  const commands = useMemo(
    () => (slash.open ? filterSlashCommands(slash.query) : []),
    [slash.open, slash.query]
  );
  const commandsRef = useRef(commands);
  commandsRef.current = commands;

  const applyCommand = useCallback((command: SlashCommand, ed: Editor) => {
    const { from, to } = slashRef.current;
    setSlash(INITIAL_SLASH);

    // Defer one frame so the portal unmount + mobile keyboard don't steal focus mid-command
    window.requestAnimationFrame(() => {
      ed.commands.focus();

      if (command.id === 'todo') {
        const chain = ed.chain().focus();
        if (from >= 0 && to >= from) chain.deleteRange({ from, to });
        const ok = chain.toggleTaskList().run();
        if (!ok) ed.commands.toggleTaskList();
        return;
      }

      if (from >= 0 && to >= from) {
        ed.chain().focus().deleteRange({ from, to }).run();
      }
      command.run(ed);
    });
  }, []);

  const applyCommandRef = useRef(applyCommand);
  applyCommandRef.current = applyCommand;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'note-link' },
      }),
      TaskList.configure({
        HTMLAttributes: { class: 'note-task-list' },
      }),
      TaskItem.extend({
        addNodeView() {
          return ReactNodeViewRenderer(TaskItemView, {
            as: 'li',
            className: 'note-task-host',
          });
        },
      }).configure({
        nested: true,
      }),
      Placeholder.configure({ placeholder }),
      Markdown,
    ],
    content: value || '',
    contentType: 'markdown',
    autofocus: autoFocus ? 'end' : false,
    editorProps: {
      attributes: {
        class: 'note-editor-content markdown-preview focus:outline-none',
      },
      handleKeyDown: (_view, event) => {
        const current = slashRef.current;
        if (!current.open) return false;

        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          setSlash(INITIAL_SLASH);
          return true;
        }

        const list = commandsRef.current;
        const ed = editorRef.current;

        if (event.key === 'ArrowDown') {
          event.preventDefault();
          setSlash((s) => ({
            ...s,
            selectedIndex: list.length ? (s.selectedIndex + 1) % list.length : 0,
          }));
          return true;
        }

        if (event.key === 'ArrowUp') {
          event.preventDefault();
          setSlash((s) => ({
            ...s,
            selectedIndex: list.length
              ? (s.selectedIndex - 1 + list.length) % list.length
              : 0,
          }));
          return true;
        }

        if ((event.key === 'Enter' || event.key === 'Tab') && ed) {
          const cmd = list[current.selectedIndex];
          if (cmd) {
            event.preventDefault();
            applyCommandRef.current(cmd, ed);
            return true;
          }
        }

        return false;
      },
    },
    onCreate: ({ editor: ed }) => {
      editorRef.current = ed;
    },
    onUpdate: ({ editor: ed }) => {
      editorRef.current = ed;
      skipNextSync.current = true;
      onChangeRef.current(getMarkdown(ed));

      const found = detectSlash(ed);
      if (found) {
        const prev = slashRef.current;
        const queryChanged = !prev.open || prev.query !== found.query;
        setSlash({
          open: true,
          query: found.query,
          from: found.from,
          to: found.to,
          selectedIndex: queryChanged ? 0 : prev.selectedIndex,
          position: getSuggestionCoords(ed),
        });
      } else if (slashRef.current.open && !slashLockRef.current) {
        setSlash(INITIAL_SLASH);
      }
    },
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // Sync external value → editor (e.g. opening another note)
  useEffect(() => {
    if (!editor) return;
    if (skipNextSync.current) {
      skipNextSync.current = false;
      return;
    }
    const current = getMarkdown(editor);
    if (value !== current) {
      editor.commands.setContent(value || '', { contentType: 'markdown' });
    }
  }, [value, editor]);

  useEffect(() => {
    if (autoFocus && editor && !editor.isFocused) {
      editor.commands.focus('end');
    }
  }, [autoFocus, editor]);

  useEffect(() => {
    if (autoFocus || !editor) return;
    // Keep keyboard closed until the user taps the text area
    if (editor.isFocused) editor.commands.blur();
  }, [autoFocus, editor]);

  useEffect(() => {
    if (!editor || !slash.open) return;
    const reposition = () => {
      setSlash((s) =>
        s.open ? { ...s, position: getSuggestionCoords(editor) } : s
      );
    };
    window.visualViewport?.addEventListener('resize', reposition);
    window.visualViewport?.addEventListener('scroll', reposition);
    window.addEventListener('resize', reposition);
    return () => {
      window.visualViewport?.removeEventListener('resize', reposition);
      window.visualViewport?.removeEventListener('scroll', reposition);
      window.removeEventListener('resize', reposition);
    };
  }, [editor, slash.open]);

  if (!editor) return null;

  const isFullscreen = variant === 'fullscreen';
  const isEmbedded = variant === 'embedded';

  const shellClass = isFullscreen
    ? 'note-editor-shell note-editor-shell--fullscreen flex-1 cursor-text min-h-0 overflow-y-auto'
    : isEmbedded
      ? 'note-editor-shell note-editor-shell--embedded cursor-text min-h-0'
      : 'note-editor-shell rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/80 px-4 py-3 focus-within:ring-2 focus-within:ring-zinc-400/50 transition-shadow cursor-text';

  return (
    <div
      className={`relative ${isFullscreen || isEmbedded ? 'flex flex-col min-h-0' : ''}`}
    >
      <div
        className={shellClass}
        style={
          isFullscreen
            ? undefined
            : { minHeight: `${Math.max(minRows, 4) * 1.55}rem` }
        }
        onClick={() => editor.commands.focus()}
      >
        <EditorContent editor={editor} />
      </div>

      {!isFullscreen && !isEmbedded && (
        <p className="mt-1.5 px-1 text-[10px] text-zinc-400">
          Markdown interprété en direct · tapez <kbd className="font-mono">/</kbd> pour formater
        </p>
      )}

      {slash.open && (
        <SlashCommandMenu
          commands={commands}
          selectedIndex={slash.selectedIndex}
          onSelect={(cmd) => applyCommand(cmd, editor)}
          onHover={(index) => setSlash((s) => ({ ...s, selectedIndex: index }))}
          position={slash.position}
          onLockChange={(locked) => {
            slashLockRef.current = locked;
          }}
        />
      )}
    </div>
  );
};
