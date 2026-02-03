/**
 * Modal for browsing and adding components from the registry to an agent.
 * Provides search, type filtering, and displays already-added state.
 * Only shows Add button for components where agent has executor or contributor permission.
 */

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../ui/Modal';
import { SearchInput } from '../ui/SearchInput';
import { componentRegistryService } from '../../services/componentRegistry';
import { apiClient } from '../../services/api';
import type { RegistryComponentType, ComponentRegistryEntry, ComponentAccessLevel } from '../../types';

/**
 * Props for the AddFromLibraryModal component.
 */
interface AddFromLibraryModalProps {
  /** Whether the modal is open. */
  isOpen: boolean;
  /** Callback to close the modal. */
  onClose: () => void;
  /** The ID of the agent to add components to. */
  agentId: string;
  /** Optional callback when a component is successfully added. */
  onSuccess?: () => void;
}

/**
 * Response type for agent registry refs.
 */
interface AgentRegistryRef {
  id: string;
  agent_id: string;
  registry_component_id: string;
  added_at: string;
}

interface AgentRegistryRefsResponse {
  data: AgentRegistryRef[];
  total: number;
}

/**
 * Response type for agent component grants.
 */
interface AgentComponentGrant {
  id: string;
  component_id: string;
  agent_id: string;
  access_level: ComponentAccessLevel;
  granted_at: string;
  is_active: boolean;
}

interface AgentComponentGrantsResponse {
  data: AgentComponentGrant[];
  total: number;
}

/**
 * Card component for displaying a registry component.
 * Shows Add button only for executor/contributor access, otherwise shows View Only.
 */
function RegistryCard({
  component,
  isAdded,
  isAdding,
  canAdd,
  accessLevel,
  onAdd,
}: {
  component: ComponentRegistryEntry;
  isAdded: boolean;
  isAdding: boolean;
  canAdd: boolean;
  accessLevel: ComponentAccessLevel | null;
  onAdd: () => void;
}) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium text-gray-900 truncate">
              {component.name}
            </h4>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
              {component.type}
            </span>
          </div>
          {component.description && (
            <p className="text-xs text-gray-600 mt-1 line-clamp-2">
              {component.description}
            </p>
          )}
          {component.tags && component.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {component.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        {canAdd ? (
          <button
            onClick={onAdd}
            disabled={isAdded || isAdding}
            className={`ml-2 px-3 py-1.5 text-xs font-medium rounded-md ${
              isAdded
                ? 'bg-green-100 text-green-800 cursor-default'
                : isAdding
                ? 'bg-gray-100 text-gray-500 cursor-wait'
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
          >
            {isAdded ? 'Added' : isAdding ? 'Adding...' : 'Add'}
          </button>
        ) : (
          <span
            className="ml-2 px-3 py-1.5 text-xs font-medium rounded-md bg-gray-100 text-gray-500 cursor-default"
            title={accessLevel === 'viewer' ? 'Viewer access only - request executor or contributor access to add' : 'No access - request access to add'}
          >
            View Only
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Modal for browsing and adding components from the registry to an agent.
 * Features search, type filtering, and tracks which components are already added.
 */
export function AddFromLibraryModal({
  isOpen,
  onClose,
  agentId,
  onSuccess,
}: AddFromLibraryModalProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<RegistryComponentType | ''>('');
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set());
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  // Fetch component registry entries with search and type filter
  const { data: registryData, isLoading: isLoadingRegistry } = useQuery({
    queryKey: ['component-registry', 'modal', search, typeFilter],
    queryFn: () => componentRegistryService.list({
      search: search || undefined,
      type: typeFilter || undefined,
      limit: 50,
    }),
    enabled: isOpen,
  });

  // Fetch existing registry refs for this agent
  const { data: refsData } = useQuery({
    queryKey: ['agent-registry-refs', agentId],
    queryFn: async () => {
      const response = await apiClient.get<AgentRegistryRefsResponse>(
        `/api/agents/${agentId}/registry-refs`
      );
      return response.data;
    },
    enabled: isOpen && Boolean(agentId),
  });

  // Fetch agent's component grants to determine permissions
  const { data: grantsData } = useQuery({
    queryKey: ['agent-component-grants', agentId],
    queryFn: async () => {
      const response = await apiClient.get<AgentComponentGrantsResponse>(
        `/api/agents/${agentId}/component-grants`
      );
      return response.data;
    },
    enabled: isOpen && Boolean(agentId),
  });

  // Build a map of component_id -> access_level for quick lookup
  const componentAccessMap = useMemo(() => {
    const map = new Map<string, ComponentAccessLevel>();
    grantsData?.data?.forEach((grant) => {
      if (grant.is_active) {
        map.set(grant.component_id, grant.access_level);
      }
    });
    return map;
  }, [grantsData]);

  /**
   * Check if agent can add a component (has executor or contributor access).
   */
  const canAddComponent = (componentId: string): boolean => {
    const accessLevel = componentAccessMap.get(componentId);
    return accessLevel === 'executor' || accessLevel === 'contributor';
  };

  /**
   * Get the access level for a component (null if no grant).
   */
  const getAccessLevel = (componentId: string): ComponentAccessLevel | null => {
    return componentAccessMap.get(componentId) || null;
  };

  // Mutation for adding components
  const addMutation = useMutation({
    mutationFn: async (registryComponentId: string) => {
      const response = await apiClient.post(
        `/api/agents/${agentId}/registry-refs`,
        { registry_component_id: registryComponentId }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-registry-refs', agentId] });
      onSuccess?.();
    },
  });

  // Compute set of already-linked component IDs
  const alreadyAddedIds = useMemo(() => {
    const ids = new Set<string>();
    refsData?.data?.forEach((ref) => ids.add(ref.registry_component_id));
    addedIds.forEach((id) => ids.add(id));
    return ids;
  }, [refsData, addedIds]);

  /**
   * Handles adding a component to the agent.
   */
  const handleAdd = (componentId: string) => {
    setAddingIds((prev) => new Set(prev).add(componentId));

    addMutation.mutate(componentId, {
      onSuccess: () => {
        setAddingIds((prev) => {
          const next = new Set(prev);
          next.delete(componentId);
          return next;
        });
        setAddedIds((prev) => new Set(prev).add(componentId));
      },
      onError: () => {
        setAddingIds((prev) => {
          const next = new Set(prev);
          next.delete(componentId);
          return next;
        });
      },
    });
  };

  /**
   * Handles closing the modal and resetting state.
   */
  const handleClose = () => {
    setSearch('');
    setTypeFilter('');
    setAddedIds(new Set());
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add from Component Registry" size="xl">
      <div className="space-y-4">
        {/* Filters */}
        <div className="flex gap-3">
          <div className="flex-1">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search components..."
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as RegistryComponentType | '')}
            className="block w-40 pl-3 pr-10 py-2 text-sm border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">All Types</option>
            <option value="skill">Skills</option>
            <option value="tool">Tools</option>
            <option value="memory">Memory</option>
          </select>
        </div>

        {/* Component Grid */}
        <div className="max-h-96 overflow-y-auto">
          {isLoadingRegistry ? (
            <div className="text-center py-8">
              <div className="animate-spin inline-block h-8 w-8 border-4 border-gray-200 border-t-indigo-600 rounded-full" />
              <p className="mt-2 text-sm text-gray-500">Loading components...</p>
            </div>
          ) : !registryData?.data?.length ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500">No components found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {registryData.data.map((component) => (
                <RegistryCard
                  key={component.id}
                  component={component}
                  isAdded={alreadyAddedIds.has(component.id)}
                  isAdding={addingIds.has(component.id)}
                  canAdd={canAddComponent(component.id)}
                  accessLevel={getAccessLevel(component.id)}
                  onAdd={() => handleAdd(component.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-4 border-t">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}
