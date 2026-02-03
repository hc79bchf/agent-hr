/**
 * AddToAgentModal component for adding a library component to an agent.
 * Shows a list of agents that can receive the component.
 */

import { useState, useCallback, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { useAgents, useAddLibraryRefToAgent } from '../../hooks';
import type { LibraryComponent } from '../../types';

/**
 * Props for AddToAgentModal.
 */
interface AddToAgentModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** The library component to add to an agent */
  libraryComponent: LibraryComponent | null;
  /** Callback when component is successfully added */
  onSuccess?: () => void;
}

/**
 * AddToAgentModal component.
 */
export function AddToAgentModal({
  isOpen,
  onClose,
  libraryComponent,
  onSuccess,
}: AddToAgentModalProps) {
  // State
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch agents
  const { data: agentsData, isLoading: isLoadingAgents } = useAgents({
    queryOptions: {
      enabled: isOpen,
    },
  });

  // Add to agent mutation
  const addToAgentMutation = useAddLibraryRefToAgent();

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedAgentId(null);
      setError(null);
    }
  }, [isOpen]);

  // Handle close
  const handleClose = useCallback(() => {
    if (!addToAgentMutation.isPending) {
      setSelectedAgentId(null);
      setError(null);
      onClose();
    }
  }, [addToAgentMutation.isPending, onClose]);

  // Handle submit
  const handleSubmit = useCallback(() => {
    if (!selectedAgentId || !libraryComponent) {
      setError('Please select an agent');
      return;
    }

    setError(null);
    addToAgentMutation.mutate(
      {
        agentId: selectedAgentId,
        data: { library_component_id: libraryComponent.id },
      },
      {
        onSuccess: () => {
          handleClose();
          onSuccess?.();
        },
        onError: (err: Error) => {
          setError(err.message || 'Failed to add component to agent');
        },
      }
    );
  }, [selectedAgentId, libraryComponent, addToAgentMutation, handleClose, onSuccess]);

  const isSubmitting = addToAgentMutation.isPending;
  const agents = agentsData?.data || [];

  // Footer buttons
  const footer = (
    <div className="flex items-center justify-end gap-3">
      <button
        type="button"
        onClick={handleClose}
        disabled={isSubmitting}
        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isSubmitting || !selectedAgentId}
        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? 'Adding...' : 'Add to Agent'}
      </button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Add to Agent"
      size="md"
      footer={footer}
      closeOnEscape={!isSubmitting}
      closeOnBackdropClick={!isSubmitting}
    >
      <div className="space-y-4">
        {/* Component info */}
        {libraryComponent && (
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-md">
            <p className="text-sm font-medium text-gray-900">{libraryComponent.name}</p>
            <p className="text-xs text-gray-500 mt-1">
              Type: {libraryComponent.type}
            </p>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Agent selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select an Agent
          </label>

          {isLoadingAgents ? (
            <div className="text-sm text-gray-500">Loading agents...</div>
          ) : agents.length === 0 ? (
            <div className="text-sm text-gray-500">
              No agents available. Create an agent first.
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {agents.map((agent) => (
                <label
                  key={agent.id}
                  className={`flex items-center p-3 border rounded-md cursor-pointer transition-colors ${
                    selectedAgentId === agent.id
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="agent"
                    value={agent.id}
                    checked={selectedAgentId === agent.id}
                    onChange={() => setSelectedAgentId(agent.id)}
                    disabled={isSubmitting}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                  />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-900">{agent.name}</p>
                    {agent.description && (
                      <p className="text-xs text-gray-500 line-clamp-1">
                        {agent.description}
                      </p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
