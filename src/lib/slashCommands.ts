import type { Editor } from '@tiptap/react';

export interface SlashCommand {
  id: string;
  label: string;
  description: string;
  keywords: string[];
  run: (editor: Editor) => void;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: 'h1',
    label: 'Titre',
    description: 'Titre principal',
    keywords: ['titre', 'h1', 'heading', 'title'],
    run: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    id: 'h2',
    label: 'Sous-titre',
    description: 'Titre de niveau 2',
    keywords: ['sous-titre', 'h2', 'subtitle', 'heading'],
    run: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    id: 'h3',
    label: 'Titre 3',
    description: 'Titre de niveau 3',
    keywords: ['h3', 'titre3'],
    run: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    id: 'quote',
    label: 'Citation',
    description: 'Bloc de citation',
    keywords: ['citation', 'quote', 'blockquote'],
    run: (editor) => editor.chain().focus().toggleBlockquote().run(),
  },
  {
    id: 'bold',
    label: 'Gras',
    description: 'Texte en gras',
    keywords: ['gras', 'bold', 'strong'],
    run: (editor) => editor.chain().focus().toggleBold().run(),
  },
  {
    id: 'italic',
    label: 'Italique',
    description: 'Texte en italique',
    keywords: ['italique', 'italic', 'em'],
    run: (editor) => editor.chain().focus().toggleItalic().run(),
  },
  {
    id: 'strike',
    label: 'Barré',
    description: 'Texte barré',
    keywords: ['barré', 'barre', 'strike', 'strikethrough'],
    run: (editor) => editor.chain().focus().toggleStrike().run(),
  },
  {
    id: 'code',
    label: 'Code',
    description: 'Code en ligne',
    keywords: ['code', 'inline'],
    run: (editor) => editor.chain().focus().toggleCode().run(),
  },
  {
    id: 'codeblock',
    label: 'Bloc de code',
    description: 'Bloc de code multiligne',
    keywords: ['bloc', 'codeblock', 'fence'],
    run: (editor) => editor.chain().focus().toggleCodeBlock().run(),
  },
  {
    id: 'ul',
    label: 'Liste',
    description: 'Liste à puces',
    keywords: ['liste', 'list', 'ul', 'bullet'],
    run: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    id: 'ol',
    label: 'Liste numérotée',
    description: 'Liste ordonnée',
    keywords: ['numérotée', 'numbered', 'ol', 'ordered'],
    run: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    id: 'link',
    label: 'Lien',
    description: 'Lien hypertexte',
    keywords: ['lien', 'link', 'url'],
    run: (editor) => {
      const url = window.prompt('URL du lien', 'https://');
      if (!url) return;
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    },
  },
  {
    id: 'hr',
    label: 'Séparateur',
    description: 'Ligne horizontale',
    keywords: ['séparateur', 'separator', 'hr', 'divider'],
    run: (editor) => editor.chain().focus().setHorizontalRule().run(),
  },
];

export function filterSlashCommands(query: string): SlashCommand[] {
  const q = query.toLowerCase().trim();
  if (!q) return SLASH_COMMANDS;
  return SLASH_COMMANDS.filter(
    (cmd) =>
      cmd.label.toLowerCase().includes(q) ||
      cmd.keywords.some((k) => k.includes(q) || q.includes(k))
  );
}
