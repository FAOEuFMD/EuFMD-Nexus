import React from 'react';

interface CollapsibleSidePanelProps {
  title: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onClose?: () => void;
  className?: string;
  children: React.ReactNode;
}

const CollapsibleSidePanel: React.FC<CollapsibleSidePanelProps> = ({
  title,
  collapsed,
  onToggleCollapse,
  onClose,
  className = '',
  children,
}) => {
  if (collapsed) {
    return (
      <div
        className={`flex flex-col items-center bg-gray-50 border-l border-gray-200 lg:h-[600px] w-10 shrink-0 ${className}`}
      >
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex-1 flex items-center justify-center w-full hover:bg-gray-100 transition-colors"
          title={`Expand ${title}`}
          aria-label={`Expand ${title}`}
        >
          <span
            className="text-xs font-semibold text-gray-600 tracking-wide"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          >
            {title}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col bg-gray-50 border-l border-gray-200 lg:h-[600px] shrink-0 ${className}`}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-white shrink-0">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex items-center gap-1 text-sm font-semibold text-gray-800 hover:text-green-700"
          aria-expanded
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {title}
        </button>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 text-sm px-2 py-1 rounded hover:bg-gray-100"
            aria-label="Close panel"
          >
            Close
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">{children}</div>
    </div>
  );
};

export default CollapsibleSidePanel;
