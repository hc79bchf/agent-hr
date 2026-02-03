/**
 * MemorySection component displays a group of memory items by type.
 */

import { useState } from 'react';
import type { Component } from '../../types';
import type { MemoryType } from '../../types/memory';
import { MEMORY_TYPE_INFO } from '../../types/memory';

interface MemorySectionProps {
  /** Memory type for this section */
  type: MemoryType;
  /** Memory components to display */
  memories: Component[];
  /** Pending suggestions count (for long_term only) */
  pendingCount?: number;
  /** Callback when edit is clicked */
  onEdit?: (memory: Component) => void;
  /** Callback when delete is clicked */
  onDelete?: (memory: Component) => void;
  /** Callback when pending badge is clicked */
  onViewPending?: () => void;
  /** Callback when inject button is clicked (procedural type only) */
  onInject?: () => void;
  /** Whether actions are disabled */
  disabled?: boolean;
}

/**
 * MemoryCard displays a single memory item.
 */
function MemoryCard({
  memory,
  onEdit,
  onDelete,
  disabled,
}: {
  memory: Component;
  onEdit?: () => void;
  onDelete?: () => void;
  disabled?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border border-gray-200 rounded-lg p-3 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-sm font-medium text-gray-900 hover:text-indigo-600 truncate text-left"
          >
            {memory.name}
            <svg
              className={`inline ml-1 w-4 h-4 text-gray-400 transition-transform ${
                isExpanded ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
          {memory.description && (
            <p className="text-xs text-gray-500 mt-1 truncate">{memory.description}</p>
          )}
        </div>

        <div className="flex items-center gap-1 ml-2">
          {onEdit && (
            <button
              onClick={onEdit}
              disabled={disabled}
              className="p-1 text-gray-400 hover:text-indigo-600 disabled:opacity-50"
              title="Edit"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              onClick={onDelete}
              disabled={disabled}
              className="p-1 text-gray-400 hover:text-red-600 disabled:opacity-50"
              title="Delete"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      </div>

      {isExpanded && memory.content && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <pre className="text-xs text-gray-600 whitespace-pre-wrap overflow-auto max-h-48 font-mono bg-gray-50 p-2 rounded">
            {memory.content}
          </pre>
        </div>
      )}
    </div>
  );
}

/**
 * MemorySection component.
 */
export function MemorySection({
  type,
  memories,
  pendingCount = 0,
  onEdit,
  onDelete,
  onViewPending,
  onInject,
  disabled,
}: MemorySectionProps) {
  const info = MEMORY_TYPE_INFO[type];
  const isWorking = type === 'working';

  return (
    <div className="space-y-3">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium text-gray-900">{info.label}</h4>
          <p className="text-xs text-gray-500">{info.description}</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Inject button for procedural memory */}
          {type === 'procedural' && onInject && (
            <button
              onClick={onInject}
              disabled={disabled}
              className="inline-flex items-center px-2 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 rounded-full hover:bg-indigo-100 disabled:opacity-50"
              title="Inject procedural memory"
            >
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Inject
            </button>
          )}

          {/* Pending suggestions badge for long-term memory */}
          {type === 'long_term' && pendingCount > 0 && (
            <button
              onClick={onViewPending}
              className="inline-flex items-center px-2 py-1 text-xs font-medium text-amber-700 bg-amber-50 rounded-full hover:bg-amber-100"
            >
              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                  clipRule="evenodd"
                />
              </svg>
              {pendingCount} pending
            </button>
          )}
        </div>
      </div>

      {/* Memory Cards */}
      {memories.length === 0 ? (
        <div className="text-center py-6 border border-dashed border-gray-200 rounded-lg">
          <svg
            className="mx-auto h-8 w-8 text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="mt-1 text-sm text-gray-500">
            {isWorking ? 'No active context' : 'No memories yet'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {memories.map((memory) => (
            <MemoryCard
              key={memory.id}
              memory={memory}
              onEdit={!isWorking && onEdit ? () => onEdit(memory) : undefined}
              onDelete={!isWorking && onDelete ? () => onDelete(memory) : undefined}
              disabled={disabled}
            />
          ))}
        </div>
      )}
    </div>
  );
}
