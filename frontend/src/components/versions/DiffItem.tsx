/**
 * DiffItem component for displaying a single component diff between versions.
 * Shows change type (added/removed/modified) with expandable content.
 */

import { useState } from 'react';
import type { ComponentDiff } from '../../types';

interface DiffItemProps {
  diff: ComponentDiff;
}

/**
 * Component that renders a single diff item with collapsible details.
 */
export function DiffItem({ diff }: DiffItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const icon = {
    added: { symbol: '+', color: 'text-green-600', bg: 'bg-green-50' },
    removed: { symbol: '-', color: 'text-red-600', bg: 'bg-red-50' },
    modified: { symbol: '~', color: 'text-yellow-600', bg: 'bg-yellow-50' },
  }[diff.change_type];

  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between py-2 px-3 hover:bg-gray-50 text-left"
        type="button"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2">
          <span
            className={`w-5 h-5 flex items-center justify-center rounded text-sm font-mono ${icon.color} ${icon.bg}`}
          >
            {icon.symbol}
          </span>
          <span className="text-sm text-gray-900">{diff.name}</span>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
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

      {isExpanded && (
        <div className="px-3 pb-3">
          {diff.change_type === 'added' && (
            <div className="bg-green-50 border border-green-200 rounded p-3">
              <p className="text-xs text-green-700 font-medium mb-1">
                Added in Version B:
              </p>
              <pre className="text-xs text-green-900 whitespace-pre-wrap overflow-auto max-h-48">
                {diff.content_b}
              </pre>
            </div>
          )}

          {diff.change_type === 'removed' && (
            <div className="bg-red-50 border border-red-200 rounded p-3">
              <p className="text-xs text-red-700 font-medium mb-1">
                Removed from Version A:
              </p>
              <pre className="text-xs text-red-900 whitespace-pre-wrap overflow-auto max-h-48">
                {diff.content_a}
              </pre>
            </div>
          )}

          {diff.change_type === 'modified' && (
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-red-50 border border-red-200 rounded p-3">
                <p className="text-xs text-red-700 font-medium mb-1">Version A:</p>
                <pre className="text-xs text-red-900 whitespace-pre-wrap overflow-auto max-h-48">
                  {diff.content_a}
                </pre>
              </div>
              <div className="bg-green-50 border border-green-200 rounded p-3">
                <p className="text-xs text-green-700 font-medium mb-1">Version B:</p>
                <pre className="text-xs text-green-900 whitespace-pre-wrap overflow-auto max-h-48">
                  {diff.content_b}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
