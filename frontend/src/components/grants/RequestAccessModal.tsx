/**
 * RequestAccessModal component.
 * Modal for requesting access to a component for one or more agents.
 */

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { accessRequestsService } from '../../services/grants';
import { useAgents } from '../../hooks';
import type { ComponentAccessLevel } from '../../types';
import { Modal } from '../ui';

interface RequestAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  componentId: string;
  componentName?: string;
}

const ACCESS_LEVEL_OPTIONS: { value: ComponentAccessLevel; label: string; description: string }[] = [
  {
    value: 'executor',
    label: 'Executor',
    description: 'Can execute and use the component',
  },
  {
    value: 'contributor',
    label: 'Contributor',
    description: 'Can modify the component',
  },
];

export function RequestAccessModal({
  isOpen,
  onClose,
  componentId,
  componentName,
}: RequestAccessModalProps) {
  const queryClient = useQueryClient();
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<ComponentAccessLevel>('executor');
  const [error, setError] = useState<string | null>(null);

  // Fetch agents for dropdown
  const { data: agentsData, isLoading: isLoadingAgents } = useAgents({
    queryOptions: { enabled: isOpen },
  });

  // Fetch pending access requests for this component to filter out agents with existing requests
  const { data: pendingRequests } = useQuery({
    queryKey: ['access-requests', 'component', componentId, 'pending'],
    queryFn: () => accessRequestsService.listByComponent(componentId, { status: 'pending' }),
    enabled: isOpen && !!componentId,
  });

  const agents = agentsData?.data || [];

  // Get agent IDs that already have pending requests
  const pendingAgentIds = useMemo(() => {
    const requests = pendingRequests?.data || [];
    return new Set(requests.map((r) => r.agent_id));
  }, [pendingRequests]);

  // Filter out agents that already have pending requests
  const availableAgents = useMemo(() => {
    return agents.filter((agent) => !pendingAgentIds.has(agent.id));
  }, [agents, pendingAgentIds]);

  // Agents with pending requests (for display)
  const agentsWithPendingRequests = useMemo(() => {
    return agents.filter((agent) => pendingAgentIds.has(agent.id));
  }, [agents, pendingAgentIds]);

  const createMutation = useMutation({
    mutationFn: async () => {
      // Create access requests for all selected agents
      const results = await Promise.allSettled(
        selectedAgentIds.map((agentId) =>
          accessRequestsService.create(agentId, {
            component_id: componentId,
            requested_level: selectedLevel,
          })
        )
      );

      // Count successes and failures
      const successes = results.filter((r) => r.status === 'fulfilled');
      const failures = results.filter((r) => r.status === 'rejected');

      if (failures.length > 0 && successes.length === 0) {
        // All failed
        throw new Error('All requests failed. The selected agents may already have pending requests.');
      } else if (failures.length > 0) {
        // Partial success
        throw new Error(
          `${successes.length} request(s) succeeded, ${failures.length} failed (may already have pending requests)`
        );
      }

      return { successes: successes.length, failures: failures.length };
    },
    onSuccess: () => {
      // Invalidate all related queries
      selectedAgentIds.forEach((agentId) => {
        queryClient.invalidateQueries({ queryKey: ['access-requests', 'agent', agentId] });
      });
      queryClient.invalidateQueries({ queryKey: ['access-requests', 'component', componentId] });
      handleClose();
    },
    onError: (err: Error) => {
      setError(err.message);
      // Refresh pending requests to update the list
      queryClient.invalidateQueries({ queryKey: ['access-requests', 'component', componentId] });
    },
  });

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      if (selectedAgentIds.length === 0) {
        setError('Please select at least one agent');
        return;
      }

      createMutation.mutate();
    },
    [createMutation, selectedAgentIds]
  );

  const handleClose = useCallback(() => {
    setSelectedAgentIds([]);
    setSelectedLevel('executor');
    setError(null);
    onClose();
  }, [onClose]);

  const handleAgentToggle = useCallback((agentId: string) => {
    setSelectedAgentIds((prev) =>
      prev.includes(agentId)
        ? prev.filter((id) => id !== agentId)
        : [...prev, agentId]
    );
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedAgentIds.length === availableAgents.length) {
      setSelectedAgentIds([]);
    } else {
      setSelectedAgentIds(availableAgents.map((a) => a.id));
    }
  }, [availableAgents, selectedAgentIds.length]);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Request Access">
      <form onSubmit={handleSubmit} className="space-y-6">
        {componentName && (
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">Requesting access to:</p>
            <p className="text-lg font-medium text-gray-900">{componentName}</p>
          </div>
        )}

        {/* Agent Selection */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-medium text-gray-700">
              Select Agents
            </label>
            {availableAgents.length > 0 && (
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-sm text-indigo-600 hover:text-indigo-800"
              >
                {selectedAgentIds.length === availableAgents.length ? 'Deselect All' : 'Select All'}
              </button>
            )}
          </div>

          {isLoadingAgents ? (
            <div className="text-sm text-gray-500 py-4 text-center">Loading agents...</div>
          ) : availableAgents.length === 0 && agentsWithPendingRequests.length === 0 ? (
            <div className="text-sm text-gray-500 py-4 text-center border border-gray-200 rounded-md">
              No agents available
            </div>
          ) : (
            <>
              {availableAgents.length > 0 && (
                <div className="border border-gray-200 rounded-md max-h-48 overflow-y-auto">
                  {availableAgents.map((agent) => (
                    <label
                      key={agent.id}
                      className={`flex items-center px-4 py-3 cursor-pointer hover:bg-gray-50 border-b border-gray-100 last:border-b-0 ${
                        selectedAgentIds.includes(agent.id) ? 'bg-indigo-50' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedAgentIds.includes(agent.id)}
                        onChange={() => handleAgentToggle(agent.id)}
                        className="h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                      />
                      <div className="ml-3 flex-1">
                        <span className="text-sm font-medium text-gray-900">{agent.name}</span>
                        {agent.description && (
                          <p className="text-xs text-gray-500 truncate">{agent.description}</p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {/* Show agents with pending requests */}
              {agentsWithPendingRequests.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-gray-500 mb-2">
                    Already have pending requests ({agentsWithPendingRequests.length}):
                  </p>
                  <div className="border border-gray-100 rounded-md bg-gray-50">
                    {agentsWithPendingRequests.map((agent) => (
                      <div
                        key={agent.id}
                        className="flex items-center px-4 py-2 border-b border-gray-100 last:border-b-0 opacity-50"
                      >
                        <svg className="h-4 w-4 text-yellow-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span className="text-sm text-gray-600">{agent.name}</span>
                        <span className="ml-auto text-xs text-yellow-600">Pending</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {availableAgents.length === 0 && agentsWithPendingRequests.length > 0 && (
                <div className="text-sm text-gray-500 py-4 text-center border border-gray-200 rounded-md mb-3">
                  All agents already have pending requests
                </div>
              )}
            </>
          )}

          {selectedAgentIds.length > 0 && (
            <p className="mt-2 text-sm text-gray-600">
              {selectedAgentIds.length} agent{selectedAgentIds.length !== 1 ? 's' : ''} selected
            </p>
          )}
        </div>

        {/* Access Level */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Access Level
          </label>
          <div className="space-y-3">
            {ACCESS_LEVEL_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`relative flex cursor-pointer rounded-lg border p-4 focus:outline-none ${
                  selectedLevel === option.value
                    ? 'border-indigo-600 bg-indigo-50 ring-2 ring-indigo-600'
                    : 'border-gray-300 bg-white hover:border-gray-400'
                }`}
              >
                <input
                  type="radio"
                  name="access_level"
                  value={option.value}
                  checked={selectedLevel === option.value}
                  onChange={(e) => setSelectedLevel(e.target.value as ComponentAccessLevel)}
                  className="sr-only"
                />
                <div className="flex flex-1">
                  <div className="flex flex-col">
                    <span
                      className={`block text-sm font-medium ${
                        selectedLevel === option.value ? 'text-indigo-900' : 'text-gray-900'
                      }`}
                    >
                      {option.label}
                    </span>
                    <span
                      className={`mt-1 flex items-center text-sm ${
                        selectedLevel === option.value ? 'text-indigo-700' : 'text-gray-500'
                      }`}
                    >
                      {option.description}
                    </span>
                  </div>
                </div>
                {selectedLevel === option.value && (
                  <svg
                    className="h-5 w-5 text-indigo-600"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </label>
            ))}
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <div className="flex">
            <svg
              className="h-5 w-5 text-yellow-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                Your request will be sent to the component owner for approval.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createMutation.isPending || selectedAgentIds.length === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {createMutation.isPending
              ? 'Submitting...'
              : `Request Access${selectedAgentIds.length > 1 ? ` (${selectedAgentIds.length})` : ''}`}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default RequestAccessModal;
