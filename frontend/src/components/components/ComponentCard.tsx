/**
 * ComponentCard component for displaying a skill, tool, or memory component in a card layout.
 */

import { useState } from 'react';
import type { Component } from '../../types';
import { Badge } from '../ui';

/**
 * ComponentCard component props.
 */
interface ComponentCardProps {
  component: Component;
  onClick?: (component: Component) => void;
  isSelectable?: boolean;
  isSelected?: boolean;
  onSelect?: (component: Component, selected: boolean) => void;
  isReadOnly?: boolean;
  onEdit?: (component: Component) => void;
  onDelete?: (component: Component) => void;
  onPublish?: (component: Component) => void;
}

/**
 * Get icon for component type.
 */
function getComponentIcon(type: Component['type']): JSX.Element {
  switch (type) {
    case 'skill':
      return (
        <svg
          className="h-5 w-5 text-indigo-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
          />
        </svg>
      );
    case 'mcp_tool':
      return (
        <svg
          className="h-5 w-5 text-green-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      );
    case 'memory':
      return (
        <svg
          className="h-5 w-5 text-purple-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
          />
        </svg>
      );
    default:
      return (
        <svg
          className="h-5 w-5 text-gray-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      );
  }
}

/**
 * Get badge variant for component type.
 */
function getTypeBadgeVariant(type: Component['type']): 'info' | 'success' | 'warning' {
  switch (type) {
    case 'skill':
      return 'info';
    case 'mcp_tool':
      return 'success';
    case 'memory':
      return 'warning';
    default:
      return 'info';
  }
}

/**
 * Get label for component type.
 */
function getTypeLabel(type: Component['type']): string {
  switch (type) {
    case 'skill':
      return 'Skill';
    case 'mcp_tool':
      return 'MCP Tool';
    case 'memory':
      return 'Memory';
    default:
      return type;
  }
}

/**
 * Card component for displaying a component (skill, tool, or memory).
 */
export function ComponentCard({
  component,
  onClick,
  isSelectable = false,
  isSelected = false,
  onSelect,
  isReadOnly = false,
  onEdit,
  onDelete,
  onPublish,
}: ComponentCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleClick = () => {
    if (onClick) {
      onClick(component);
    } else {
      setIsExpanded(!isExpanded);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    onSelect?.(component, e.target.checked);
  };

  return (
    <div
      className={`bg-white rounded-lg border transition-all duration-200 ${
        isExpanded ? 'shadow-md border-indigo-300' : 'shadow hover:shadow-md border-gray-200'
      } ${isSelected ? 'ring-2 ring-indigo-500' : ''}`}
    >
      {/* Card Header */}
      <div
        className={`p-4 ${onClick || !isReadOnly ? 'cursor-pointer' : ''}`}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        aria-label={`${isReadOnly ? 'View' : 'Edit'} component ${component.name}`}
      >
        <div className="flex items-start gap-3">
          {/* Selection Checkbox */}
          {isSelectable && (
            <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={isSelected}
                onChange={handleCheckboxChange}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                aria-label={`Select ${component.name} for export`}
              />
            </div>
          )}

          {/* Icon */}
          <div className="flex-shrink-0 pt-0.5">{getComponentIcon(component.type)}</div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="text-sm font-semibold text-gray-900 truncate">
                {component.name}
              </h4>
              <Badge variant={getTypeBadgeVariant(component.type)} className="text-xs">
                {getTypeLabel(component.type)}
              </Badge>
              {isReadOnly && (
                <Badge variant="default" className="text-xs">
                  Read-only
                </Badge>
              )}
            </div>

            {component.description && (
              <p className="text-sm text-gray-600 line-clamp-2">{component.description}</p>
            )}

            {component.source_path && (
              <p className="text-xs text-gray-400 mt-1 truncate font-mono">
                {component.source_path}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          {(onEdit || onDelete || onPublish) && (
            <div className="flex-shrink-0 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              {onPublish && (
                <button
                  onClick={() => onPublish(component)}
                  className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                  aria-label={`Publish ${component.name} to library`}
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
              {onEdit && (
                <button
                  onClick={() => onEdit(component)}
                  className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                  aria-label={`Edit ${component.name}`}
                  title="Edit"
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
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => onDelete(component)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  aria-label={`Delete ${component.name}`}
                  title="Delete"
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
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              )}
            </div>
          )}

          {/* Expand/Collapse Indicator */}
          {!onClick && !onEdit && !onDelete && !onPublish && (
            <div className="flex-shrink-0">
              <svg
                className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${
                  isExpanded ? 'rotate-180' : ''
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && component.content && (
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <h5 className="text-xs font-medium text-gray-700 mb-2">Content:</h5>
          <pre className="text-xs text-gray-600 whitespace-pre-wrap break-words bg-white p-3 rounded border border-gray-200 max-h-64 overflow-auto">
            {component.content}
          </pre>
        </div>
      )}
    </div>
  );
}
