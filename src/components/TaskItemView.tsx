import React, { useEffect, useRef, useState } from 'react';
import { NodeViewWrapper, NodeViewContent, type NodeViewProps } from '@tiptap/react';

/**
 * Custom task checkbox: rounded square, perimeter stroke draws around the box,
 * then a progressive strikethrough covers only the text width.
 *
 * Uses display:contents so checkbox + text are flex children of the outer <li>
 * created by ReactNodeViewRenderer({ as: 'li' }).
 */
export const TaskItemView: React.FC<NodeViewProps> = ({
  node,
  updateAttributes,
  selected,
}) => {
  const checked = Boolean(node.attrs.checked);
  const [animating, setAnimating] = useState(false);
  const [showStrike, setShowStrike] = useState(checked);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      setShowStrike(checked);
      return;
    }

    if (checked) {
      setShowStrike(false);
      setAnimating(true);
      const strikeTimer = window.setTimeout(() => setShowStrike(true), 420);
      const endTimer = window.setTimeout(() => setAnimating(false), 920);
      return () => {
        window.clearTimeout(strikeTimer);
        window.clearTimeout(endTimer);
      };
    }

    setAnimating(false);
    setShowStrike(false);
    return undefined;
  }, [checked]);

  const toggle = (e: React.MouseEvent | React.ChangeEvent) => {
    e.preventDefault();
    e.stopPropagation();
    updateAttributes({ checked: !checked });
  };

  return (
    <NodeViewWrapper
      as="div"
      data-type="taskItem"
      data-checked={checked ? 'true' : 'false'}
      className={`note-task-item ${checked ? 'note-task-item--checked' : ''} ${
        animating ? 'note-task-item--animating' : ''
      } ${showStrike ? 'note-task-item--struck' : ''} ${selected ? 'is-selected' : ''}`}
    >
      <label className="note-task-checkbox" contentEditable={false}>
        <input
          type="checkbox"
          checked={checked}
          onChange={toggle}
          onMouseDown={(e) => e.preventDefault()}
          tabIndex={-1}
          aria-label={checked ? 'Décocher' : 'Cocher'}
        />
        <span className="note-task-checkbox-face" aria-hidden>
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
      </label>
      <NodeViewContent className="note-task-content" as="div" />
    </NodeViewWrapper>
  );
};
