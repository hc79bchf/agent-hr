/**
 * ComponentGrantsSection component.
 * Displays and manages grants (access permissions) for a component.
 */

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { grantsService } from '../../services/grants';
import { useAgents } from '../../hooks';
import type { ComponentGrant, ComponentAccessLevel, ComponentGrantCreate } from '../../types';
import { Modal } from '../ui';

interface ComponentGrantsSectionProps {
  componentId: string;
}

const ACCESS_LEVEL_LABELS: Record<ComponentAccessLevel, string> = {
  viewer: 'Viewer',
  executor: 'Executor',
  contributor: 'Contributor',
};

const ACCESS_LEVEL_DESCRIPTIONS: Record<ComponentAccessLevel, string> = {
  viewer: 'Can view component details',
  executor: 'Can execute/use the component',
  contributor: 'Can modify the component',
};

const ACCESS_LEVEL_COLORS: Record<ComponentAccessLevel, string> = {
  viewer: 'bg-gray-100 text-gray-800',
  executor: 'bg-blue-100 text-blue-800',
  contributor: 'bg-green-100 text-green-800',
};

interface GrantFormData {
  agent_id: string;
  access_level: ComponentAccessLevel;
}

export function ComponentGrantsSection({ componentId }: ComponentGrantsSectionProps) {
  const queryClient = useQueryClient();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formData, setFormData] = useState<GrantFormData>({
    agent_id: '',
    access_level: 'viewer',
  });

  // Fetch agents for the dropdown and display names
  const { data: agentsData, isLoading: isLoadingAgents } = useAgents();
  const agents = agentsData?.data || [];

  // Create a lookup map for agent names
  const agentNameMap = agents.reduce((map, agent) => {
    map[agent.id] = agent.name;
    return map;
  }, {} as Record<string, string>);

  const getAgentName = (agentId: string) => agentNameMap[agentId] || `Agent ${agentId.slice(0, 8)}...`;

  // Fetch grants
  const {
    data: grantsResponse,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['component-grants', componentId],
    queryFn: () => grantsService.listByComponent(componentId),
  });

  const grants = grantsResponse?.data || [];

  // Create grant mutation
  const createMutation = useMutation({
    mutationFn: (data: Omit<ComponentGrantCreate, 'component_id'>) =>
      grantsService.create(componentId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['component-grants', componentId] });
      handleCloseModal();
    },
  });

  // Update grant mutation
  const updateMutation = useMutation({
    mutationFn: ({ agentId, accessLevel }: { agentId: string; accessLevel: ComponentAccessLevel }) =>
      grantsService.update(componentId, agentId, { access_level: accessLevel }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['component-grants', componentId] });
    },
  });

  // Revoke grant mutation
  const revokeMutation = useMutation({
    mutationFn: (agentId: string) => grantsService.revoke(componentId, agentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['component-grants', componentId] });
    },
  });

  const handleOpenModal = useCallback(() => {
    setFormData({ agent_id: '', access_level: 'viewer' });
    setIsAddModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsAddModalOpen(false);
    setFormData({ agent_id: '', access_level: 'viewer' });
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      createMutation.mutate(formData);
    },
    [formData, createMutation]
  );

  const handleRevoke = useCallback(
    (grant: ComponentGrant) => {
      const agentName = agentNameMap[grant.agent_id] || grant.agent_id;
      if (window.confirm(`Revoke access for ${agentName}?`)) {
        revokeMutation.mutate(grant.agent_id);
      }
    },
    [revokeMutation, agentNameMap]
  );

  const handleAccessLevelChange = useCallback(
    (grant: ComponentGrant, newLevel: ComponentAccessLevel) => {
      updateMutation.mutate({ agentId: grant.agent_id, accessLevel: newLevel });
    },
    [updateMutation]
  );

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <span className="ml-3 text-gray-600">Loading grants...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <h3 className="text-sm font-medium text-red-800">Error loading grants</h3>
        <p className="mt-1 text-sm text-red-700">
          {(error as Error)?.message || 'An unexpected error occurred'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Access Grants</h3>
          <p className="mt-1 text-sm text-gray-500">
            Manage which agents can access this component
          </p>
        </div>
        <button
          onClick={handleOpenModal}
          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
        >
          <svg
            className="-ml-1 mr-2 h-5 w-5"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
              clipRule="evenodd"
            />
          </svg>
          Grant Access
        </button>
      </div>

      {/* Grants List */}
      {grants.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No grants</h3>
          <p className="mt-1 text-sm text-gray-500">
            Grant access to agents to allow them to use this component
          </p>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {grants.filter(g => g.is_active).map((grant) => (
              <li key={grant.id} className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center min-w-0">
                    <div className="flex-shrink-0">
                      <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                        <svg
                          className="h-6 w-6 text-indigo-600"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                          />
                        </svg>
                      </div>
                    </div>
                    <div className="ml-4 truncate">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {getAgentName(grant.agent_id)}
                      </p>
                      <p className="text-sm text-gray-500">
                        Granted {new Date(grant.granted_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <select
                      value={grant.access_level}
                      onChange={(e) =>
                        handleAccessLevelChange(grant, e.target.value as ComponentAccessLevel)
                      }
                      className={`text-xs font-medium rounded-full px-3 py-1 ${ACCESS_LEVEL_COLORS[grant.access_level]} border-0 focus:ring-2 focus:ring-indigo-500`}
                    >
                      {Object.entries(ACCESS_LEVEL_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleRevoke(grant)}
                      className="text-sm text-red-600 hover:text-red-900"
                    >
                      Revoke
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Add Grant Modal */}
      <Modal isOpen={isAddModalOpen} onClose={handleCloseModal} title="Grant Access">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="agent_id" className="block text-sm font-medium text-gray-700">
              Agent
            </label>
            {isLoadingAgents ? (
              <div className="mt-1 text-sm text-gray-500">Loading agents...</div>
            ) : agents.length === 0 ? (
              <div className="mt-1 text-sm text-gray-500">
                No agents available. Create an agent first.
              </div>
            ) : (
              <select
                id="agent_id"
                value={formData.agent_id}
                onChange={(e) => setFormData({ ...formData, agent_id: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                required
              >
                <option value="">Select an agent...</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label htmlFor="access_level" className="block text-sm font-medium text-gray-700">
              Access Level
            </label>
            <select
              id="access_level"
              value={formData.access_level}
              onChange={(e) =>
                setFormData({ ...formData, access_level: e.target.value as ComponentAccessLevel })
              }
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              {Object.entries(ACCESS_LEVEL_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label} - {ACCESS_LEVEL_DESCRIPTIONS[value as ComponentAccessLevel]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={handleCloseModal}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || !formData.agent_id}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Granting...' : 'Grant Access'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default ComponentGrantsSection;
