/**
 * MemorySuggestionsModal component for reviewing pending memory suggestions.
 */

import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import {
  useMemorySuggestions,
  useApproveMemorySuggestion,
  useRejectMemorySuggestion,
} from '../../hooks';
import { MEMORY_TYPE_INFO } from '../../types/memory';
import type { MemorySuggestion, MemoryType } from '../../types/memory';

interface MemorySuggestionsModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** Agent ID to show suggestions for */
  agentId: string;
  /** Callback when a suggestion is approved (memory created) */
  onApprove?: () => void;
}

/**
 * Single suggestion card for review.
 */
function SuggestionCard({
  suggestion,
  onApprove,
  onReject,
  isProcessing,
}: {
  suggestion: MemorySuggestion;
  onApprove: () => void;
  onReject: () => void;
  isProcessing: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const typeInfo = MEMORY_TYPE_INFO[suggestion.suggested_type as MemoryType];

  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-gray-900">{suggestion.suggested_name}</h4>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="info">{typeInfo?.label || suggestion.suggested_type}</Badge>
            <span className="text-xs text-gray-400">
              {new Date(suggestion.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      {/* Content Preview */}
      <div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
        >
          {isExpanded ? 'Hide' : 'Show'} content
          <svg
            className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isExpanded && (
          <pre className="mt-2 p-3 bg-gray-50 rounded text-xs text-gray-700 whitespace-pre-wrap overflow-auto max-h-48 font-mono">
            {suggestion.suggested_content}
          </pre>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
        <button
          onClick={onReject}
          disabled={isProcessing}
          className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          Reject
        </button>
        <button
          onClick={onApprove}
          disabled={isProcessing}
          className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
        >
          {isProcessing ? 'Processing...' : 'Approve'}
        </button>
      </div>
    </div>
  );
}

/**
 * MemorySuggestionsModal component.
 */
export function MemorySuggestionsModal({
  isOpen,
  onClose,
  agentId,
  onApprove,
}: MemorySuggestionsModalProps) {
  const [processingId, setProcessingId] = useState<string | null>(null);

  const { data: suggestions, isLoading, refetch } = useMemorySuggestions(agentId, 'pending', isOpen);
  const approveMutation = useApproveMemorySuggestion();
  const rejectMutation = useRejectMemorySuggestion();

  const handleApprove = (suggestionId: string) => {
    setProcessingId(suggestionId);
    approveMutation.mutate(
      { agentId, suggestionId },
      {
        onSuccess: () => {
          setProcessingId(null);
          refetch();
          onApprove?.();
        },
        onError: () => {
          setProcessingId(null);
        },
      }
    );
  };

  const handleReject = (suggestionId: string) => {
    setProcessingId(suggestionId);
    rejectMutation.mutate(
      { agentId, suggestionId },
      {
        onSuccess: () => {
          setProcessingId(null);
          refetch();
        },
        onError: () => {
          setProcessingId(null);
        },
      }
    );
  };

  const pendingCount = suggestions?.data?.length || 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Memory Suggestions"
      size="lg"
    >
      <div className="space-y-4">
        {/* Description */}
        <p className="text-sm text-gray-600">
          The agent has suggested adding the following items to long-term memory. Review and
          approve or reject each suggestion.
        </p>

        {/* Suggestions List */}
        <div className="max-h-96 overflow-y-auto space-y-3">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin inline-block h-8 w-8 border-4 border-gray-200 border-t-indigo-600 rounded-full" />
              <p className="mt-2 text-sm text-gray-500">Loading suggestions...</p>
            </div>
          ) : pendingCount === 0 ? (
            <div className="text-center py-8">
              <svg
                className="mx-auto h-12 w-12 text-gray-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="mt-2 text-sm text-gray-500">No pending suggestions</p>
            </div>
          ) : (
            suggestions?.data?.map((suggestion) => (
              <SuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                onApprove={() => handleApprove(suggestion.id)}
                onReject={() => handleReject(suggestion.id)}
                isProcessing={processingId === suggestion.id}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
