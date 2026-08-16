import React from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownPreviewProps {
  content: string;
  className?: string;
  compact?: boolean;
}

/** Static checkbox matching the note-detail TipTap task UI (read-only). */
function PreviewTaskCheckbox({ checked }: { checked: boolean }) {
  return (
    <span
      className={`note-task-checkbox note-task-checkbox--preview ${
        checked ? 'note-task-item--checked' : ''
      }`}
      aria-hidden
    >
      <span className="note-task-checkbox-face">
        <svg className="note-task-checkbox-svg" viewBox="0 0 20 20" fill="none">
          <rect
            className="note-task-checkbox-ring"
            x="1.25"
            y="1.25"
            width="17.5"
            height="17.5"
            rx="4.5"
            pathLength="100"
          />
          <path
            className="note-task-checkbox-tick"
            d="M5.5 10.2 L8.6 13.2 L14.5 6.8"
            pathLength="100"
          />
        </svg>
      </span>
    </span>
  );
}

function isTaskListItem(className?: string): boolean {
  return Boolean(className?.includes('task-list-item'));
}

function extractCheckbox(
  children: React.ReactNode
): { checked: boolean; rest: React.ReactNode } | null {
  const list = React.Children.toArray(children);
  let checked: boolean | null = null;
  const rest: React.ReactNode[] = [];

  for (const child of list) {
    if (
      React.isValidElement<{ type?: string; checked?: boolean }>(child) &&
      (child.props.type === 'checkbox' || child.type === 'input')
    ) {
      checked = Boolean(child.props.checked);
      continue;
    }
    // react-markdown may pass a raw input via props
    if (
      React.isValidElement(child) &&
      typeof child.type === 'string' &&
      child.type === 'input'
    ) {
      const props = child.props as { type?: string; checked?: boolean };
      if (props.type === 'checkbox') {
        checked = Boolean(props.checked);
        continue;
      }
    }
    rest.push(child);
  }

  if (checked === null) return null;
  return { checked, rest };
}

const markdownComponents: Components = {
  ul: ({ className, children, ...props }) => {
    const isTask = className?.includes('contains-task-list');
    return (
      <ul
        className={`${className || ''} ${isTask ? 'note-task-list note-task-list--preview' : ''}`.trim()}
        {...props}
      >
        {children}
      </ul>
    );
  },
  li: ({ className, children, ...props }) => {
    if (!isTaskListItem(className)) {
      return (
        <li className={className} {...props}>
          {children}
        </li>
      );
    }

    const parsed = extractCheckbox(children);
    const checked = parsed?.checked ?? false;
    const body = parsed?.rest ?? children;

    return (
      <li
        className={`note-task-host note-task-host--preview task-list-item ${
          checked ? 'note-task-host--checked' : ''
        }`}
        data-checked={checked ? 'true' : 'false'}
        {...props}
      >
        <div
          className={`note-task-item note-task-item--preview ${
            checked ? 'note-task-item--checked note-task-item--struck' : ''
          }`}
        >
          <PreviewTaskCheckbox checked={checked} />
          <div className="note-task-content note-task-content--preview">
            <div className="note-task-text">{body}</div>
          </div>
        </div>
      </li>
    );
  },
  input: ({ type, checked, ...props }) => {
    // Hide native GFM checkbox — replaced inside custom `li`
    if (type === 'checkbox') {
      return (
        <input
          type="checkbox"
          checked={checked}
          readOnly
          tabIndex={-1}
          className="note-task-native-hidden"
          {...props}
        />
      );
    }
    return <input type={type} checked={checked} {...props} />;
  },
};

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
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {content}
        </ReactMarkdown>
      )}
    </div>
  );
};
