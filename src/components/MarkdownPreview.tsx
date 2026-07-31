import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownPreviewProps {
  content: string;
  className?: string;
  compact?: boolean;
}

export const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({
  content,
  className = '',
  compact = false,
}) => {
  const empty = !content.trim();

  return (
    <div
      className={`markdown-preview ${compact ? 'markdown-preview--compact' : ''} ${className}`}
    >
      {empty ? (
        <p className="text-zinc-400 dark:text-zinc-500 italic text-sm font-light">
          Commencez à écrire…
        </p>
      ) : (
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      )}
    </div>
  );
};
