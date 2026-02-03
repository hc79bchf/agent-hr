/**
 * TanStack Query hooks for fetching and updating a single agent.
 */

import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { getAgent, updateAgent } from '../services';
import type { Agent, AgentUpdate } from '../types';
import { agentKeys } from './useAgents';

/**
 * Default refetch interval for agent detail (5 seconds).
 * This ensures running status updates are reflected without page refresh.
 */
const DEFAULT_REFETCH_INTERVAL = 5000;

/**
 * Hook options for useAgent.
 */
interface UseAgentOptions {
  enabled?: boolean;
  queryOptions?: Omit<
    UseQueryOptions<Agent, Error>,
    'queryKey' | 'queryFn' | 'enabled'
  >;
}

/**
 * Hook for fetching a single agent by ID.
 * @param id - The agent's UUID.
 * @param options - Query options.
 * @returns Query result with agent data.
 */
export function useAgent(id: string, options: UseAgentOptions = {}) {
  const { enabled = true, queryOptions } = options;

  return useQuery<Agent, Error>({
    queryKey: agentKeys.detail(id),
    queryFn: () => getAgent(id),
    enabled: enabled && Boolean(id),
    refetchInterval: DEFAULT_REFETCH_INTERVAL,
    ...queryOptions,
  });
}

/**
 * Hook for updating an agent.
 * @returns Mutation result for updating an agent.
 */
export function useUpdateAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AgentUpdate }) =>
      updateAgent(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: agentKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: agentKeys.lists() });
    },
  });
}
