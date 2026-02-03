/**
 * WorkingMemoryPanel component for viewing and injecting working memory.
 */

import { useState } from 'react';
import { useWorkingMemory, useInjectWorkingMemory, useClearWorkingMemory } from '../../hooks';
import type { WorkingMemoryItem } from '../../types/memory';

interface WorkingMemoryPanelProps {
  /** Deployment ID to show working memory for */
  deploymentId: string | null;
}

/**
 * Single working memory item display.
 */
function WorkingMemoryItemCard({ item }: { item: WorkingMemoryItem }) {
  const sourceLabel = {
    system: 'System',
    user: 'Injected',
    conversation: 'Conversation',
  }[item.source];

  const sourceColor = {
    system: 'bg-gray-100 text-gray-600',
    user: 'bg-indigo-100 text-indigo-600',
    conversation: 'bg-green-100 text-green-600',
  }[item.source];

  return (
    <div className="flex items-start gap-2 p-2 bg-gray-50 rounded text-xs">
      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${sourceColor}`}>
        {sourceLabel}
      </span>
      <p className="flex-1 text-gray-700 line-clamp-2">{item.content}</p>
    </div>
  );
}

/**
 * WorkingMemoryPanel component.
 */
export function WorkingMemoryPanel({ deploymentId }: WorkingMemoryPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [injectContent, setInjectContent] = useState('');
  const [showInjectForm, setShowInjectForm] = useState(false);

  const { data: workingMemory, isLoading } = useWorkingMemory(deploymentId || '', !!deploymentId);
  const injectMutation = useInjectWorkingMemory();
  const clearMutation = useClearWorkingMemory();

  const totalItems =
    (workingMemory?.items?.length || 0) + (workingMemory?.user_injected?.length || 0);

  const handleInject = () => {
    if (!deploymentId || !injectContent.trim()) return;

    injectMutation.mutate(
      { deploymentId, content: injectContent.trim() },
      {
        onSuccess: () => {
          setInjectContent('');
          setShowInjectForm(false);
        },
      }
    );
  };

  const handleClear = () => {
    if (!deploymentId) return;
    if (window.confirm('Clear all working memory? This cannot be undone.')) {
      clearMutation.mutate(deploymentId);
    }
  };

  // No deployment = show placeholder
  if (!deploymentId) {
    return (
      <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
        <div className="flex items-center gap-2 text-gray-500">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <div>
            <h4 className="text-sm font-medium">Working Memory</h4>
            <p className="text-xs">Deploy the agent to view working memory</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
          <div className="text-left">
            <h4 className="text-sm font-medium text-gray-900">Working Memory (Session)</h4>
            <p className="text-xs text-gray-500">
              {isLoading ? 'Loading...' : `${totalItems} active context items`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowInjectForm(true);
              setIsExpanded(true);
            }}
            className="px-2 py-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded"
          >
            + Inject Context
          </button>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-3 space-y-3 border-t border-gray-200">
          {/* Inject Form */}
          {showInjectForm && (
            <div className="p-3 bg-indigo-50 rounded-lg space-y-2">
              <label className="block text-xs font-medium text-indigo-700">
                Inject Context
              </label>
              <textarea
                value={injectContent}
                onChange={(e) => setInjectContent(e.target.value)}
                placeholder="Enter context to inject into working memory..."
                rows={3}
                className="w-full px-2 py-1.5 text-sm border border-indigo-200 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowInjectForm(false);
                    setInjectContent('');
                  }}
                  className="px-3 py-1 text-xs font-medium text-gray-600 hover:text-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleInject}
                  disabled={!injectContent.trim() || injectMutation.isPending}
                  className="px-3 py-1 text-xs font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50"
                >
                  {injectMutation.isPending ? 'Injecting...' : 'Inject'}
                </button>
              </div>
            </div>
          )}

          {/* Memory Items */}
          {isLoading ? (
            <div className="text-center py-4">
              <div className="animate-spin inline-block h-6 w-6 border-2 border-gray-200 border-t-indigo-600 rounded-full" />
            </div>
          ) : totalItems === 0 ? (
            <p className="text-center text-sm text-gray-500 py-4">No active context</p>
          ) : (
            <div className="space-y-2">
              {/* User-injected items first */}
              {workingMemory?.user_injected?.map((item) => (
                <WorkingMemoryItemCard key={item.id} item={item} />
              ))}
              {/* System/conversation items */}
              {workingMemory?.items?.map((item) => (
                <WorkingMemoryItemCard key={item.id} item={item} />
              ))}
            </div>
          )}

          {/* Clear button */}
          {totalItems > 0 && (
            <div className="pt-2 border-t border-gray-100">
              <button
                onClick={handleClear}
                disabled={clearMutation.isPending}
                className="text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
              >
                {clearMutation.isPending ? 'Clearing...' : 'Clear Working Memory'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
