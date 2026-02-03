/**
 * FolderCard component for displaying a component folder in a card layout.
 */

import type { ComponentFolder, ComponentType } from '../../types';
import { Badge } from '../ui';

/**
 * FolderCard component props.
 */
interface FolderCardProps {
  folder: ComponentFolder;
  onClick?: (folder: ComponentFolder) => void;
  onPublish?: (folder: ComponentFolder) => void;
}

/**
 * Get icon for folder based on component type.
 */
function getFolderIcon(type: ComponentType): JSX.Element {
  const baseClass = 'h-6 w-6';

  switch (type) {
    case 'skill':
      return (
        <svg
          className={`${baseClass} text-indigo-500`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
          />
        </svg>
      );
    case 'mcp_tool':
      return (
        <svg
          className={`${baseClass} text-green-500`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
          />
        </svg>
      );
    case 'memory':
      return (
        <svg
          className={`${baseClass} text-purple-500`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
          />
        </svg>
      );
    case 'agent':
      return (
        <svg
          className={`${baseClass} text-orange-500`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
          />
        </svg>
      );
    default:
      return (
        <svg
          className={`${baseClass} text-gray-500`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
          />
        </svg>
      );
  }
}

/**
 * Get badge variant for component type.
 */
function getTypeBadgeVariant(type: ComponentType): 'info' | 'success' | 'warning' | 'default' {
  switch (type) {
    case 'skill':
      return 'info';
    case 'mcp_tool':
      return 'success';
    case 'memory':
      return 'warning';
    case 'agent':
      return 'default';
    default:
      return 'default';
  }
}

/**
 * Get label for component type.
 */
function getTypeLabel(type: ComponentType): string {
  switch (type) {
    case 'skill':
      return 'Skills';
    case 'mcp_tool':
      return 'MCP Tools';
    case 'memory':
      return 'Memory';
    case 'agent':
      return 'Agents';
    default:
      return type;
  }
}

/**
 * Card component for displaying a component folder.
 */
export function FolderCard({ folder, onClick, onPublish }: FolderCardProps) {
  const handleClick = () => {
    onClick?.(folder);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  const handlePublish = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPublish?.(folder);
  };

  // Check if this is the "Ungrouped" synthetic folder
  const isUngrouped = folder.id === '00000000-0000-0000-0000-000000000000';

  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 shadow hover:shadow-md transition-all duration-200 cursor-pointer ${
        isUngrouped ? 'border-dashed border-gray-300' : ''
      }`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`View folder ${folder.name}`}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Folder Icon */}
          <div className="flex-shrink-0 pt-0.5">{getFolderIcon(folder.type)}</div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="text-sm font-semibold text-gray-900 truncate">
                {folder.name}
              </h4>
              <Badge variant={getTypeBadgeVariant(folder.type)} className="text-xs">
                {getTypeLabel(folder.type)}
              </Badge>
              <Badge variant="default" className="text-xs">
                {folder.file_count} {folder.file_count === 1 ? 'file' : 'files'}
              </Badge>
            </div>

            {folder.description && (
              <p className="text-sm text-gray-600 line-clamp-2">{folder.description}</p>
            )}

            {folder.source_path && (
              <p className="text-xs text-gray-400 mt-1 truncate font-mono">
                {folder.source_path}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex-shrink-0 flex items-center gap-1">
            {onPublish && !isUngrouped && (
              <button
                onClick={handlePublish}
                className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                aria-label={`Publish ${folder.name} to library`}
                title="Publish to Library"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z"
                  />
                </svg>
              </button>
            )}

            {/* Chevron */}
            <svg
              className="h-5 w-5 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
